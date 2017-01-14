// Command translation table
const CMDS = {
	'model': {
		code: 0x0001,
		ro: () => Buffer.alloc( 0 ),
		ri: ( b ) => b.toString()
	},
	'name': {
		code: 0x0003,
		ro: () => Buffer.alloc( 0 ),
		ri: ( b ) => b.toString()
	},
	'mac': {
		code: 0x0004,
		ro: () => Buffer.alloc( 0 ),
		ri: ( b ) => {
			let ret = [];
			for( let i = 0; i < b.length; i ++ ) ret.push( b[i].toString( 16 ) );
			return ret.join( ':' );
		}
	},
	'dhcp': {
		code: 0x000b,
		ro: () => Buffer.alloc( 0 ),
		ri: ( b ) => {
			return ( b[0] == 0 ) ? false : true;
		}
	},
	'ip': {
		code: 0x0006,
		ro: () => Buffer.alloc( 0 ),
		ri: ( b ) => {
			let ret = [];
			for( let i = 0; i < b.length; i ++ ) ret.push( b[i].toString( 10 ) );
			return ret.join( '.' );
		}
	},
	'port_stat': {
		code: 0x1000,
		ro: () => Buffer.alloc( 0 ),
		ri: ( b ) => [ b[0], b.readUIntBE( 1, 8 ), b.readUIntBE( 9, 8 ) ] // port, recv, sent
	},
	'firmwarev': {
		code: 0x000d,
		ro: () => Buffer.alloc( 0 ),
		ri: ( b ) => parseInt( b.toString().replace( /\./g, '' ) )
	},
	'password': {
		code: 0x000a,
		wo: ( passwd ) => { return Buffer.from( passwd ) },
		wi: ( b ) => b
	},
	'reset_port_stat': {
		code: 0x1400,
		wo: () => Buffer.from( [1] ),
		wi: ( b ) => b
	},
	'reboot': {
		code: 0x0013,
		wo: () => Buffer.from( [1] ),
		wi: ( b ) => b
	},
	'vlan_support': {
		code: 0x2000,
		ro: () => Buffer.alloc( 0 ),
		ri: ( b ) => { switch( b[0] ) {
			case 0x00: return 'none';
			case 0x01: return 'port';
			case 0x02: return 'id';
			case 0x03: return '802.1q_id';
			case 0x04: return '802.1q_extended';
		} }
	}
}

// Marker for enf of datagram
const END = Buffer.from( [ 0xff, 0xff, 0x00, 0x00 ] );

// Lookup table for getting the command by Code
let cmdByCode = {}
for( let cmd in CMDS ) cmdByCode[ CMDS[cmd].code ] = cmd;

// Generator for outgoing packages
class PacketOut {

	constructor( cmdConverter, socket, options ) {

		if( typeof options != 'object' ) throw new Error( "options must be an object" );

		if( ! options.opCode ) options.opCode = 'read';

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
		this.header[ 1 ] = ( options.opCode == 'read' ) ? 0x01 : 0x03;
		this.header.writeUIntBE( options.lMac, 8, 6 );
		this.header.writeUIntBE( options.rMac, 14, 6 );
		this.header.writeUIntBE( options.seq, 22, 2 );
		this.header.write( 'NSDP', 24 );

		// Command store
		this.cmds = [];

		// Store socket and converter function name
		this._socket = socket;
		this._cmdConverter = cmdConverter;

	}

	addCmd( cmd, data ) {

		// Is the cmd name available?
		if( ! CMDS[cmd] ) throw new Error( `Unknown command: ${cmd}` );

		// Is the converter function available?
		if( typeof CMDS[cmd][this._cmdConverter] != 'function' ) throw new Error( `Operation not defined for ${cmd}` );

		// Call converter function
		data = CMDS[cmd][this._cmdConverter].apply( null, data );

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

	send( ip ) {

		this._socket._send(
			Buffer.concat( [ this.header ].concat( this.cmds ).concat( END ) ),
			ip
		);

	}

}

class PacketIn {

	constructor( cmdConverter, payload, assert ) {

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
			} else if( typeof CMDS[ cmd ][ cmdConverter ] != 'function' ) {
				console.log( `Cannot interprete body field ${cmdCode} due to missing converter function` );
			} else {
				if( ! ( this.body[ cmd ] instanceof Array ) ) this.body[ cmd ] = [];
				this.body[ cmd ].push( CMDS[ cmd ][ cmdConverter ].call( null, data ) );
			}

			i += 4 + len;
		}

		if( ! eof ) throw new Error( "Marker missing" );

	}

}

class PacketOutRead extends PacketOut {
	constructor( socket, options ) {
		options.opCode = 'read';
		super( 'ro', socket, options );
	}
}

class PacketOutWrite extends PacketOut {
	constructor( socket, options ) {
		options.opCode = 'write';
		super( 'wo', socket, options );
	}
}

class PacketInRead extends PacketIn {
	constructor( payload, assert ) {
		assert.opCode = 'read';
		super( 'ri', payload, assert );
	}
}

class PacketInWrite extends PacketIn {
	constructor( payload, assert ) {
		assert.opCode = 'write';
		super( 'wi', payload, assert );
	}
}

module.exports = { PacketOutRead, PacketOutWrite, PacketInRead, PacketInWrite, };
