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

	send( data, ip ) {

		if( typeof ip != 'string' ) ip = '255.255.255.255';

		// Sends out datagram
		this.socket.send( data, SENDPORT, ip );

	}

	readMessages( timeout ) { return new Promise( ( resolve ) => {

		// Reads messages from socket until timeout occurs
		let msgs = [];

		let handler = ( msg ) => msgs.push( msg );
		this.socket.on( 'message', handler );

		setTimeout( () => {
			// Remove listener and resolv with collected messages
			this.socket.removeListener( 'message', handler );
			resolve( msgs );
		}, timeout )

	} ); }

	readMessage( timeout, ip ) { return new Promise( ( resolve, reject ) => {

		// Trys to reiver a message within the given timeout
		// If ip is stated only messages matching to that IP are received
		let handler = ( msg, rinfo ) => {
			// Reject non-matching IPs
			if( ip && ip != rinfo.address ) return;

			this.socket.removeListener( 'message', handler );
			resolve( msg );
		};
		this.socket.on( 'message', handler );

		setTimeout( () => {
			this.socket.removeListener( 'message', handler );
			reject( new Error( "Timeout" ) );
		}, timeout )

	} ); }

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
