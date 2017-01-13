
class Switch {

	constructor( network, discoverPacket ) {

		this._network = network;
		this._model = discoverPacket.body.model[0];
		this._firmwarev = discoverPacket.body.firmwarev[0];
		this._name = discoverPacket.body.name[0];
		this._mac = discoverPacket.body.mac[0];
		this._ip = discoverPacket.body.ip[0];

	}

	get info() { return {
		model: this._model,
		name: this._name,
		mac: this._mac,
		ip: this._ip
	}; }

	getStats() { return this._network._getSockets().then( ( s ) => {

		let reqSeq = this._network._getSeq();

		s.w.newPacket( {
			seq: reqSeq,
			lMac: this._network._lMac,
			rMac: this.mac
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

}

module.exports = Switch;
