const os = require( 'os' );
const createSocket = require( './socket.js' );
const PacketOut = require( './packet.js' ).PacketOut;
const PacketIn = require( './packet.js' ).PacketIn;

class Network {

	constructor( interfaceName ) {

		// Get information of the given interface name
		let interfaceAddr = os.networkInterfaces()[ interfaceName ];
		if( ! interfaceAddr ) throw new Error( `Unknown interface: ${interfaceName}` );
		let interfaceInfo;
		interfaceAddr.forEach( ( i ) => {
			if( i.family == 'IPv4' ) interfaceInfo = i;
		} );
		if( ! interfaceInfo ) throw new Error( `${interfaceName} has no IPv4 address` );
		if( interfaceInfo.internal ) throw new Error( `${interfaceName} is an internal interface` );

		// Create sockets:
		this._sockets = Promise.all( [
			createSocket( interfaceInfo.address ), // Sending socket listening on the interface address
			createSocket( '255.255.255.255' )      // Receiving socket listening on the broadcast address
		] ).then( ( s ) => { return { 'w': s[0], 'r': s[1] } } );

		// Create random sequence number
		this._seq = Math.round( Math.random() * 65536 );
		
		// Store local MAC
		this._lMac = interfaceInfo.mac;


	}

	_getSockets() {
	
		// Resolve with socket instances if they are still open. Otherwise just reject.
		if( this._sockets instanceof Promise ) return this._sockets;
		return Promise.reject( "Sockets are closed" );

	}

	_getSeq() {
		// Creates a sequence number for the opration
		return this._seq++;
	}

	close() {

		// Close sockets if they are sill open
		return this._getSockets().then( ( s ) => {
			return Promise.all( [ s.r.close(), s.w.close() ] );
		} ).then( () => {
			this._sockets = null;
		} );

	}

	discover() { return this._sockets.then( (s) => {

		let reqSeq = this._getSeq();

		// Send a new packet
		s.w.send( new PacketOut( {
			lMac: this._lMac,
			seq: reqSeq
		} ).addCmds( [
			'model',
			'name',
			'mac',
			'dhcp',
			'ip'
		] ).getBuffer() );

		// Fetch answers from switches
		return s.r.readMessages( 1000 ).then( ( msgs ) => {

			let ret = [];

			// Go through all received messages and try to decode them
			// Those not matching will be ignored
			msgs.forEach( ( msg ) => { try {

				let p = new PacketIn( msg, {
					opCode: 'read',   // Must be the response of a read request
					lMac: this._lMac, // Must be addressed to our MAC
					seq: reqSeq       // Must match to the request's sequence number
				} );

				ret.push( p );

			} catch( e ) { console.log(e) } } );

			return ret;

		} );

	} ); }

}

module.exports = Network;
