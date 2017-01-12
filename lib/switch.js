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

}

module.exports = Switch;
