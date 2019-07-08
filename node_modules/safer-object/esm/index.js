/*! (c) Andrea Giammarchi - ISC */

import {call} from 'safer-function';

const {
  defineProperty,
  getPrototypeOf,
  getOwnPropertyDescriptor,
  getOwnPropertyNames,
  getOwnPropertySymbols,
  hasOwnProperty
} = Object;

const {concat, forEach, includes, push} = [];

const falsify = (descriptor, name) => {
  defineProperty(descriptor, name, {
    enumerable: true,
    value: false
  });
};

const updated = descriptor => {
  falsify(descriptor, 'configurable');
  if (call(hasOwnProperty, descriptor, 'writable'))
    falsify(descriptor, 'writable');
  return descriptor;
};

export default object => {
  const self = object;
  const names = [];
  const descriptors = [];
  do {
    call(
      forEach,
      call(
        concat,
        getOwnPropertyNames(object),
        getOwnPropertySymbols(object)
      ),
      name => {
        if (!call(includes, names, name)) {
          call(push, names, name);
          call(push, descriptors, getOwnPropertyDescriptor(object, name));
        }
      }
    );
  }
  while (object = getPrototypeOf(object));
  call(forEach, names, (name, i) => {
    defineProperty(self, name, updated(descriptors[i]));
  });
  return self;
};
