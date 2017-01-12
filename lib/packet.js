// Command translation table
const CMDS = {
	'model': {
		code: 0x0001,
		out: () => Buffer.alloc( 0 ),
		in: ( b ) => b.toString()
	},
	'name': {
		code: 0x0003,
		out: () => Buffer.alloc( 0 ),
		in: ( b ) => b.toString()
	},
	'mac': {
		code: 0x0004,
		out: () => Buffer.alloc( 0 ),
		in: ( b ) => {
			let ret = [];
			for( let i = 0; i < b.length; i ++ ) ret.push( b[i].toString( 16 ) );
			return ret.join( ':' );
		}
	},
	'dhcp': {
		code: 0x000b,
		out: () => Buffer.alloc( 0 ),
		in: ( b ) => {
			return ( b[0] == 0 ) ? false : true;
		}
	},
	'ip': {
		code: 0x0006,
		out: () => Buffer.alloc( 0 ),
		in: ( b ) => {
			let ret = [];
			for( let i = 0; i < b.length; i ++ ) ret.push( b[i].toString( 10 ) );
			return ret.join( '.' );
		}
	}
}

// Marker for enf of datagram
const END = Buffer.from( [ 0xff, 0xff, 0x00, 0x00 ] );

// Lookup table for getting the command by Code
let cmdByCode = {}
for( let cmd in CMDS ) cmdByCode[ CMDS[cmd].code ] = cmd;

// Generator for outgoing packages
class PacketOut {

	constructor( options ) {

		if( typeof options != 'object' ) throw new Error( "options must be an object" );

		if( ! options.opType ) options.opType = 'read';

		if( typeof options.lMac == 'string' ) {
			// Convert local MAC string to 48-bit integer
			let mac = options.lMac.split( ':' );
			options.lMac = 0;
			if( mac.length != 6 ) throw new Error( "Invalid lMac" );
			for( let i = 5, b = 0; i >= 0; i--, b+=8 ) {
				options.lMac += Math.pow( 2, b ) * parseInt( mac[i], 16 );
			}
		}
		if( typeof options.lMac != 'number' ) throw new Error( "Invalid lMac" );

		if( ! options.rMac ) {
			// Remote MAC is set to 00:00:00:00:00:00 for broadcast (of course?!)
			options.rMac = 0;
		} else if( typeof options.rMac == 'string' ) {
			// Convert remote MAC string to 48-bit integer
			let mac = options.rMac.split( ':' );
			options.rMac = 0;
			if( mac.length != 6 ) throw new Error( "Invalid rMac" );
			for( let i = 5, b = 0; i >= 0; i--, b+=8 ) {
				options.rMac += Math.pow( 2, b ) * parseInt( mac[i], 16 );
			}
		}
		if( typeof options.rMac != 'number' ) throw new Error( "Invalid lMac" );

		if( typeof options.seq != 'number' ) throw new Error( "Missing or invalid seq number" );
		// Clamp to 16-bit integer
		while( options.seq >= 65536 ) options.seq -= 65536;


		// Build header according to reverse engineering
		this.header = Buffer.alloc( 32 );
		this.header[ 0 ] = 0x01;
		this.header[ 1 ] = ( options.opType == 'read' ) ? 0x01 : 0x03;
		this.header.writeUIntBE( options.lMac, 8, 6 );
		this.header.writeUIntBE( options.rMac, 14, 6 );
		this.header.writeUIntBE( options.seq, 22, 2 );
		this.header.write( 'NSDP', 24 );

		// Command store
		this.cmds = [];

	}

	addCmd( cmd, data ) {

		// Is the cmd name available?
		if( ! CMDS[cmd] ) throw new Error( `Unknown command: ${cmd}` );

		// Call in function
		data = CMDS[cmd].out.apply( null, data );

		// By default data is empty
		if( ! (data instanceof Buffer) ) data = Buffer.alloc( 0 );

		// Create CMD header
		let tlv = Buffer.alloc( 4 );
		tlv.writeUIntBE( CMDS[ cmd ].code, 0, 2 );
		tlv.writeUIntBE( data.length, 2, 2 );

		// Add CMD header an data to cmds array
		this.cmds.push( Buffer.concat( [ tlv, data ] ) );

		return this;

	}

	addCmds( cmds ) {

		// Combine multiple cmds into one command
		// Format: 'string', [ array ], 'string', [ array ], ...
		let curCmd = null;
		for( let i = 0; i < cmds.length; i++ ) {

			if( typeof cmds[ i ] == 'string' ) {
				if( curCmd ) this.addCmd( curCmd );
				curCmd = cmds[i];
			} else if( ( cmds[ i ] instanceof Array ) && curCmd ) {
				this.addCmd( curCmd, cmds[ i ] );
				curCmd = null;
			} else {
				throw new Error( "Missusage of addCmds" );
			}

		}
		if( curCmd ) this.addCmd( curCmd );

		return this;

	}

	getBuffer() {
		// Return HEADER + CMD1 + ... + CMDn + END
		return Buffer.concat( [ this.header ].concat( this.cmds ).concat( END ) );
	}

}

class PacketIn {

	constructor( payload, assert ) {

		if( typeof assert != 'object' ) assert = {};

		// Decode header and check against assertation
		if( payload[0] != 0x01 ) throw new Error( "magic byte is missing" );

		let opCode = payload[1];
		if( opCode == 0x02 ) {
			this.opCode = 'read';
		} else if( opCode == 0x04 ) {
			this.opCode = 'write';
		} else {
			throw new Error( "Unknown opCode" );
		}
		if( assert.opCode && assert.opCode != this.opCode ) throw new Error( "Received wrong opCode" );


		this.lMac = payload[08].toString( 16 ) + ':'
		          + payload[09].toString( 16 ) + ':'
		          + payload[10].toString( 16 ) + ':'
		          + payload[11].toString( 16 ) + ':'
		          + payload[12].toString( 16 ) + ':'
		          + payload[13].toString( 16 );
		if( assert.lMac && assert.lMac.toLowerCase() != this.lMac ) throw new Error( "Received wrong lMac", this.lMac );

		this.rMac = payload[14].toString( 16 ) + ':'
		          + payload[15].toString( 16 ) + ':'
		          + payload[16].toString( 16 ) + ':'
		          + payload[17].toString( 16 ) + ':'
		          + payload[18].toString( 16 ) + ':'
		          + payload[19].toString( 16 );
		if( assert.rMac && assert.rMac.toLowerCase() != this.rMac ) throw new Error( "Received wrong rMac" );

		this.seq = payload.readUIntBE( 22, 2 );
		if( assert.seq && assert.seq != this.seq ) throw new Error( "Received wrong seq" );

		if( payload.slice( 24, 28 ).toString() != 'NSDP' ) throw new Error( "Magic string is missing" );


		// Decode body
		let eof = false;
		this.body = {};
		for( let i = 32; i < payload.length; ) {
			let cmdCode = payload.readUIntBE( i, 2 );
			let len = payload.readUIntBE( i + 2, 2 );
			let data = payload.slice( i + 4, i + 4 + len );

			// If the end marker has been found, set EOF flag and stop processing the body
			if( cmdCode == 0xffff ) {
				eof = true;
				break;
			}

			// Make sure we know what that field is about
			let cmd = cmdByCode[ cmdCode.toString() ];
			if( ! cmd ) {
				console.log( `Unknown body field: ${cmdCode}` );
			} else {
				if( ! ( this.body[ cmd ] instanceof Array ) ) this.body[ cmd ] = [];
				this.body[ cmd ].push( CMDS[ cmd ].in.call( null, data ) );
			}

			i += 4 + len;
		}

		if( ! eof ) throw new Error( "Marker missing" );

	}

}


module.exports = { PacketOut, PacketIn };
