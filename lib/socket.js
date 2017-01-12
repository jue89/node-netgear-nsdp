const SENDPORT = 63322;
const RECVPORT = 63321;

const dgram = require('dgram');


// Class representing a bound socket
class Socket {

	constructor( socket ) {
		this.socket = socket;
	}

	close() {
		return new Promise( ( resolve ) => {
			this.socket.close( resolve );
		} );
	}

}

// Factory for binding sockets
function createSocket( listenHost ) {

	// Create new socket. reuseAddr enables binding several applications to one port
	let s = dgram.createSocket( { type: 'udp4', reuseAddr: true } );

	// Enable sending broadcasts
	s.on( 'listening', () => s.setBroadcast( true ) );

	return new Promise( ( resolve ) => {
		// Resolve with instance of Socket after successfully binding the socket
		s.bind( RECVPORT, listenHost, () => resolve( new Socket( s ) ) );
	} );

}

module.exports = createSocket;
