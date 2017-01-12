// Command translation table
const CMDS = {
	'model' : 0x0001,
	'name'  : 0x0003,
	'mac'   : 0x0004,
	'dhcp'  : 0x000b,
	'ip'    : 0x0006
}

// Marker for enf of datagram
const END = Buffer.from( [ 0xff, 0xff, 0x00, 0x00 ] );

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

		// By default data is empty
		if( ! (data instanceof Buffer) ) data = Buffer.alloc( 0 );

		// Create CMD header
		let tlv = Buffer.alloc( 4 );
		tlv.writeUIntBE( CMDS[ cmd ], 0, 2 );
		tlv.writeUIntBE( data.length, 2, 2 );

		// Add CMD header an data to cmds array
		this.cmds.push( Buffer.concat( [ tlv, data ] ) );

		return this;

	}

	addCmds( cmds ) {

		cmds.forEach( ( cmd ) => {
			this.addCmd( cmd[0], cmd[1] );
		} );
		return this;

	}

	getBuffer() {
		// Return HEADER + CMD1 + ... + CMDn + END
		return Buffer.concat( [ this.header ].concat( this.cmds ).concat( END ) );
	}

}

module.exports = { PacketOut };
