# safer-object

<sup>**Social Media Photo by [freestocks.org](https://unsplash.com/@freestocks) on [Unsplash](https://unsplash.com/)**</sup>

[![Build Status](https://travis-ci.com/WebReflection/safer-object.svg?branch=master)](https://travis-ci.com/WebReflection/safer-object) [![Coverage Status](https://coveralls.io/repos/github/WebReflection/safer-object/badge.svg?branch=master)](https://coveralls.io/github/WebReflection/safer-promise?branch=master) ![WebReflection status](https://offline.report/status/webreflection.svg)

Flattened objects with non configurable, and non writable fields (i.e. to freeze prototypes).

```js
const obj = saferObject({
  __proto__: {
    name: 'shadowed',
    parent: 'super'
  },
  name: 'test'
});

obj.name = 'nope';
obj.parent = {nope: true};

console.assert(obj.name === 'test');
console.assert(obj.parent === 'super');
console.assert(obj.hasOwnProperty('parent'));
console.assert(obj.hasOwnProperty('hasOwnProperty'));
```
