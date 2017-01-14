const SENDPORT = 63322;
const RECVPORT = 63321;

const dgram = require('dgram');
const PacketInRead = require('./packet.js').PacketInRead;
const PacketInWrite = require('./packet.js').PacketInWrite;
const PacketOutRead = require('./packet.js').PacketOutRead;
const PacketOutWrite = require('./packet.js').PacketOutWrite;


// Class representing a bound socket
class Socket {

	constructor( socket ) {
		this.socket = socket;
	}

	_send( data, ip ) {

		if( typeof ip != 'string' ) ip = '255.255.255.255';

		// Sends out datagram
		this.socket.send( data, SENDPORT, ip );

	}

	_recvPackets( PacketIn, timeout, filter ) { return new Promise( ( resolve ) => {

		// Reads messages from socket until timeout occurs
		let packets = [];

		let handler = ( msg ) => { try {
			// Try to interprete the received message.
			// This will fail if the filter do not match.
			let p = new PacketIn( msg, filter );
			packets.push( p );
		} catch(e) {} };
		this.socket.on( 'message', handler );

		setTimeout( () => {
			// Remove listener and resolv with collected messages
			this.socket.removeListener( 'message', handler );
			resolve( packets );
		}, timeout )

	} ); }

	_recvPacket( PacketIn, timeout, filter ) { return new Promise( ( resolve, reject ) => {

		let to = setTimeout( () => {
			this.socket.removeListener( 'message', handler );
			reject( new Error( "Timeout" ) );
		}, timeout );

		// Trys to reiver a message within the given timeout
		// If ip is stated only messages matching to that IP are received
		let handler = ( msg ) => { try {
			// Try to interprete the received message.
			// This will fail if the filter do not match.
			let p = new PacketIn( msg, filter );
			this.socket.removeListener( 'message', handler );
			clearTimeout( to );
			resolve( p );
		} catch(e) {} };
		this.socket.on( 'message', handler );

	} ); }

	close() {
		return new Promise( ( resolve ) => {
			this.socket.close( resolve );
		} );
	}

	readReq( header ) { return new PacketOutRead( this, header ); }
	writeReq( header ) { return new PacketOutWrite( this, header ); }
	readRes( timeout, filter ) { return this._recvPacket( PacketInRead, timeout, filter ); }
	writeRes( timeout, filter ) { return this._recvPacket( PacketInWrite, timeout, filter ); }
	readReses( timeout, filter ) { return this._recvPackets( PacketInRead, timeout, filter ); }

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
