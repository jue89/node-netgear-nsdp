const HIGH_SECURITY = "NtgrSmartSwitchRock";

class Switch {

	constructor( network, discoverPacket ) {

		this._network = network;
		this._model = discoverPacket.body.model[0];
		this._firmwarev = discoverPacket.body.firmwarev[0];
		this._name = discoverPacket.body.name[0];
		this._mac = discoverPacket.body.mac[0];
		this._ip = discoverPacket.body.ip[0];

		this._passwd = undefined;

	}

	_getPasswd() {
		if( typeof this._passwd != 'string' ) throw new Error( "Password not set" );
		return this._passwd;
	}

	get info() { return {
		model: this._model,
		firmwarev: this._firmwarev,
		name: this._name,
		mac: this._mac,
		ip: this._ip
	}; }

	setPasswd( passwd ) {
		if( ! passwd ) {

			// Remove set password
			this._passwd = undefined;

		} else if( typeof passwd == 'string' ) {

			if( this._firmwarev > 10004 ) {
				// Switches after 1.00.04 'encrypt' the password by XORing with a magic string
				this._passwd = '';
				for( let i = 0; i < passwd.length; i++ ) {
					this._passwd += String.fromCharCode( passwd.charCodeAt(i) ^ HIGH_SECURITY.charCodeAt(i) );
				}
			} else {
				// Plain-text password
				this._passwd = passwd;
			}

		} else {

			throw new Error( "Invalid password" );

		}
	}

	getStats() { return this._network._getSockets().then( ( s ) => {

		let reqSeq = this._network._getSeq();

		s.w.newPacket( {
			seq: reqSeq,
			lMac: this._network._lMac,
			rMac: this._mac
		} ).addCmds( [
			'port_stat'
		] ).send( this._ip );

		return s.r.recvPacket( 2000, {
			opCode: 'read',
			lMac: this._network._lMac,
			rMac: this._mac,
			seq: reqSeq
		} ).then( ( packet ) => {

			// Extract stats: Field port_stats occurs several times
			let stats = {};
			packet.body.port_stat.forEach( ( p ) => {
				stats[ p[0].toString() ] = {
					recv: p[1],
					sent: p[2]
				}
			} );

			return stats;

		} );

	} ); }

	reboot() { return this._network._getSockets().then( ( s ) => {

		let reqSeq = this._network._getSeq();

		s.w.newPacket( {
			seq: reqSeq,
			opCode: 'write',
			lMac: this._network._lMac,
			rMac: this._mac
		} ).addCmds( [
			'password', [ this._getPasswd() ],
			'reboot'
		] ).send( this._ip );

		return s.r.recvPacket( 2000, {
			opCode: 'write',
			lMac: this._network._lMac,
			rMac: this._mac,
			seq: reqSeq
		} ).then( ( packet ) => {

			if( packet.body.password ) {
				return Promise.reject( new Error( "Invalid password" ) );
			}

		} );

	} ); }

	resetStats() { return this._network._getSockets().then( ( s ) => {

		let reqSeq = this._network._getSeq();

		s.w.newPacket( {
			seq: reqSeq,
			opCode: 'write',
			lMac: this._network._lMac,
			rMac: this._mac
		} ).addCmds( [
			'password', [ this._getPasswd() ],
			'reset_port_stat'
		] ).send( this._ip );

		return s.r.recvPacket( 2000, {
			opCode: 'write',
			lMac: this._network._lMac,
			rMac: this._mac,
			seq: reqSeq
		} ).then( ( packet ) => {

			if( packet.body.password ) {
				return Promise.reject( new Error( "Invalid password" ) );
			}

		} );

	} ); }

}

module.exports = Switch;
