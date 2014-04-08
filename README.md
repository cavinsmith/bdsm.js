BDSM.js extracts dominant colors from the top and the bottom areas of an image.  

![](http://i.imgur.com/eEGEjWr.jpg)  

### Quickstart

```
npm install bdsm
```

```javascript
var bdsm = require('bdsm');

bdsm.findDominantColors('image.jpg').then(function (colors) {
  console.log(colors);
});
```

will give you something like

```javascript
{ top: { r: 151, g: 189, b: 212 },
  bottom: { r: 188, g: 163, b: 147 } }
```

### Dependencies

BDSM.js uses ImageMagick and runs on Node.  
It is tested with IM 6.8.7 but other versions may work as well.

### More Examples

![](http://i.imgur.com/8jecgmN.jpg)  

 
 

![](http://i.imgur.com/l7oJnPq.jpg)  
