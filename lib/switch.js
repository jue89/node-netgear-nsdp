class Switch {

	constructor( network, discoverPacket ) {

		this._network = network;
		this._model = discoverPacket.body.model;
		this._name = discoverPacket.body.name;
		this._mac = discoverPacket.body.mac;
		this._ip = discoverPacket.body.ip;

	}

	get info() { return {
		model: this._model,
		name: this._name,
		mac: this._mac,
		ip: this._ip
	}; }

}

module.exports = Switch;
