const PacketOut = require( './packet.js' ).PacketOut;
const PacketIn = require( './packet.js' ).PacketIn;

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

		let seq = this._network._getSeq();

		s.w.send( new PacketOut( {
			seq: seq,
			lMac: this._network._lMac,
			rMac: this.mac
		} ).addCmds( [
			'port_stat'
		] ).getBuffer(), this._ip );

		return s.r.readMessage( 2000, this._ip ).then( ( msg ) => {

			// Decode packet
			let p = new PacketIn( msg, {
				opCode: 'read',
				lMac: this._network._lMac,
				rMac: this._mac,
				seq: seq
			} );

			// Extract stats: Field port_stats occurs several times
			let stats = {};
			p.body.port_stat.forEach( ( p ) => {
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
