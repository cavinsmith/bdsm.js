var _ = require('underscore'),
    Promise = require('bluebird'),
    fs = Promise.promisifyAll(require('fs')),
    im = Promise.promisifyAll(require('imagemagick'));

function sortByCountDesc(groups) {
  return _.sortBy(groups, 'count').reverse();
}

function convertRGBToYUV(rgb) {
  function y(r, g, b) {
    return ~~(0.299 * r + 0.587 * g + 0.114 * b);
  }

  function u(r, g, b) {
    return ~~(-0.169 * r - 0.331 * g + 0.499 * b + 128);
  }

  function v(r, g, b) {
    return ~~(0.499 * r - 0.418 * g - 0.0813 * b + 128);
  }

  return {
    y: y(rgb.r, rgb.g, rgb.b),
    u: u(rgb.r, rgb.g, rgb.b),
    v: v(rgb.r, rgb.g, rgb.b)
  };
}

function getColorDistance(yuv1, yuv2) {
  var dY = yuv1.y - yuv2.y,
      dU = yuv1.u - yuv2.u,
      dV = yuv1.v - yuv2.v;

  return Math.sqrt(dY * dY + dU * dU + dV * dV);
}

function parseGroup(group) {
  group = group.trim().split(': (');
  if (!group[1]) {
    return;
  }

  var color = group[1].split(')')[0].split(',');

  color = {
    r: parseInt(color[0], 10),
    g: parseInt(color[1], 10),
    b: parseInt(color[2], 10),
  };

  _.extend(color, convertRGBToYUV(color));

  return {
    color: color,
    count: parseInt(group[0], 10),
  };
}

function parseHistogram(rawHistogram) {
  var rawGroups = rawHistogram.join('').split('\n');
  return _.compact(rawGroups.map(parseGroup));
}

/**
 * Merges groups with colors that are close enough into single group.
 */
function optimizeHistogram(histogram, options) {
  options = _.defaults(options || {}, {
    colorDistanceThreshold: 22
  });

  for (var i = 0; i < histogram.length - 1; i++) {
    if (histogram[i].count === 0) {
      continue;
    }

    for (var j = i + 1; j < histogram.length; j++) {
      var distance = getColorDistance(histogram[i].color, histogram[j].color);

      if (distance <= options.colorDistanceThreshold) {
        histogram[i].count += histogram[j].count;
        histogram[j].count = 0;
      }
    }
  }

  histogram = _.filter(histogram, function (group) {
    return group.count > 0;
  });

  return sortByCountDesc(histogram);
}

function getHistogram(imageFile, direction, useBorderCropHeight, options) {
  var resizeWidth = options.resizeWidth,
      cropHeight = useBorderCropHeight ? options.borderCropHeight : options.cropHeight,
      colorCount = useBorderCropHeight ? '16' : '256',
      optimizeHistogramWithOptions = _.partial(optimizeHistogram, _, options);

  var imArgs = [
    imageFile,
    '-auto-orient',
    '-resize', resizeWidth + 'x' + resizeWidth + '>',
    '-gravity' , direction,
    '-crop', resizeWidth + 'x' + cropHeight + '+0+0',
    '-colors', colorCount,
    '-depth', '8',
    '-format', '%c', 'histogram:info:'
  ];

  return im.convertAsync(imArgs)
    .then(parseHistogram)
    .then(optimizeHistogramWithOptions);
}

function hasDominantColor(histogram) {
  var topColorCount = histogram[0].count,
      totalColorCount;

  totalColorCount = _.reduce(histogram, function (sum, color) {
    return sum + color.count;
  }, 0);

  return topColorCount / totalColorCount > 0.6;
}

function findDominantColor(imageFile, direction, options) {
  return Promise.all([
    getHistogram(imageFile, direction, false, options),
    getHistogram(imageFile, direction, true, options)
  ]).spread(function (histogram, borderHistogram) {
    return hasDominantColor(borderHistogram) ?
      borderHistogram :
      histogram;
  }).then(function (histogram) {
    return _.pick(histogram[0].color, 'r', 'g', 'b');
  });
}

function findDominantColors(imageFile, options) {
  options = _.defaults(options || {}, {
    resizeWidth: 300
  });

  options = _.defaults(options, {
    cropHeight: Math.floor(options.resizeWidth * 0.05),
    borderCropHeight: Math.floor(options.resizeWidth * 0.015)
  });

  return Promise.props({
    'top': findDominantColor(imageFile, 'north', options),
    'bottom': findDominantColor(imageFile, 'south', options)
  });
}

module.exports = {
  findDominantColors: findDominantColors
};