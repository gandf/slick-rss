function log(info) {
  self.postMessage( { type: 'log', msg: info } );
}
