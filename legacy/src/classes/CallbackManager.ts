/**
 * class for one time storage of callback functions,
 * so that they can be used on worker message
 */
export default class CallbackManager<CallbackFunction> {
  counter: number;
  callbacks: Map<number, CallbackFunction>;

  constructor() {
    this.counter = 0;
    this.callbacks = new Map();
  }

  set(callback: CallbackFunction) {
    const id = this.counter++;
    this.callbacks.set(id, callback);
    return id;
  }

  get(id: number) {
    return this.callbacks.get(id);
  }

  delete(id: number) {
    this.callbacks.delete(id);
  }

  pop(id: number) {
    const callback = this.get(id);
    this.delete(id);
    return callback;
  }
}
