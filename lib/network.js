const os = require( 'os' );
const createSocket = require( './socket.js' );

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

	}

	_getSockets() {
	
		// Resolve with socket instances if they are still open. Otherwise just reject.
		if( this._sockets instanceof Promise ) return this._sockets;
		return Promise.reject( "Sockets are closed" );

	}

	close() {

		// Close sockets if they are sill open
		return this._getSockets().then( ( s ) => {
			return Promise.all( [ s.r.close(), s.w.close() ] );
		} ).then( () => {
			this._sockets = null;
		} );

		
	}

}

module.exports = Network;
