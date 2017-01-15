Well, I copied a lot of code. That's not what you really should do. We need some refactory!

Maybe some good point to start:
Extend the following class for every command.

``` javascript
module.exports = new Cmd( 'reboot' );
class Cmd {

    constructor( name ) {
        this.name = name;
        this.code = 0x0001;
        this.getterFunctionName = 'get' + name; // Overwrite with null to disable
        this.setterFunctionName = 'set' + name; // Overwrite with null to disable
    }

    getterRequestBody( switch, params ) {
        return [ this.name ];
    }

    getterResponseBody( packet ) {
        return packet.body[ this.name ][0];
    }

    setterRequestBody( switch, params ) {
        return [
            'password', switch._getPasswd(),
            this.name, params
        ];
    }

    setterResponseBody( packet ) {
        if( packet.body.password ) {
            return Promise.reject( new Error( "Invalid password" ) );
        }
    }

    readPack( ) { return Buffer.alloc( 0 ); }

    readUnpack( buffer ) { return buffer.toString(); }

    writePack( ) { return Buffer.alloc( [ 1 ] ); }

    writeUnpack( buffer ) { return buffer; }

}
```
