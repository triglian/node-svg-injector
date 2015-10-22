var Promise = require('bluebird')
var fs = Promise.promisifyAll(require("fs"));
var http = require('http');
var https = require('https');
var path = require('path');
var cheerio = require('cheerio');
var argv = require('minimist')(process.argv.slice(2));
var promises = [];
var injectCount = 0;
var inputFile, outputFile, $;


if(argv.h || argv.help){
  process.stdout.write(fs.readFileSync('help.txt', 'utf-8'))
  process.exit();
}

if(argv.v || argv.version){
  process.stdout.write(require('package.json').version)
  process.exit();
}

inputFile = (argv._.length && path.resolve(process.cwd(), argv._[0])) || 'index.html';

// load input
try{
  var $ = cheerio.load(fs.readFileSync(inputFile, 'utf-8'), {
    decodeEntities: false,
    lowerCaseAttributeNames:false,
    lowerCaseTags:false,
    recognizeSelfClosing: true
  });
}catch(err){
  process.stderr.write(err.message + '\n' + err.stack + '\n');
}


outputFile = (argv.o || argv.out) || inputFile + '.svginjected';
outputFile = path.resolve(process.cwd(), outputFile);



function uniqueClasses(list) {
  list = list.split(' ');

  var hash = {};
  var i = list.length;
  var out = [];

  while (i--) {
    if (!hash.hasOwnProperty(list[i])) {
      hash[list[i]] = 1;
      out.unshift(list[i]);
    }
  }

  return out.join(' ');
}



function stampSVG($imgEl, str){
  //load the svg
  var svg$ = cheerio.load(str, {decodeEntities: false, xmlMode: true});
  var $svg = svg$('svg')
  
  if(! $svg.length) return;

  //grab the first svg
  $svg = svg$('svg').eq(0);

  var imgId = $imgEl.attr('id');
  if (imgId) {
    $svg.attr('id', imgId);
  }

  var imgTitle = $imgEl.attr('title');
  if (imgTitle) {
    $svg.attr('title', imgTitle);
  }

  // Concat the SVG classes + 'injected-svg' + the img classes
  var classMerge = [].concat($svg.attr('class') || [], 'injected-svg', $imgEl.attr('class') || []).join(' ');
  $svg.attr('class', uniqueClasses(classMerge));

  var imgStyle = $imgEl.attr('style');
  if (imgStyle) {
    $svg.attr('style', imgStyle);
  }

  // Copy all the data elements to the svg
  Object.keys($imgEl.data()).forEach(function(key){
    $svg.data(key, $imgEl.data(key))
  });

  // Make sure any internally referenced clipPath ids and their
  // clip-path references are unique.
  //
  // This addresses the issue of having multiple instances of the
  // same SVG on a page and only the first clipPath id is referenced.
  //
  // Browsers often shortcut the SVG Spec and don't use clipPaths
  // contained in parent elements that are hidden, so if you hide the first
  // SVG instance on the page, then all other instances lose their clipping.
  // Reference: https://bugzilla.mozilla.org/show_bug.cgi?id=376027

  // Handle all defs elements that have iri capable attributes as defined by w3c: http://www.w3.org/TR/SVG/linking.html#processingIRI
  // Mapping IRI addressable elements to the properties that can reference them:
  var iriElementsAndProperties = {
    'clipPath': ['clip-path'],
    'color-profile': ['color-profile'],
    'cursor': ['cursor'],
    'filter': ['filter'],
    'linearGradient': ['fill', 'stroke'],
    'marker': ['marker', 'marker-start', 'marker-mid', 'marker-end'],
    'mask': ['mask'],
    'pattern': ['fill', 'stroke'],
    'radialGradient': ['fill', 'stroke']
  };

  var element, elementDefs, properties, currentId, newId;
  // Object.keys(iriElementsAndProperties).forEach(function (key) {
  //   element = key;
  //   properties = iriElementsAndProperties[key];

  //   elementDefs = $svg.find('defs ' + element + '[id]');
  //   elementDefs.each(function(idx, elementDefEl){
  //     var $elementDefEl = $(elementDefEl);

  //   // for (var i = 0, elementsLen = elementDefs.length; i < elementsLen; i++) {
  //     currentId = $elementDefEl.attr('id');
  //     newId = currentId + '-' + injectCount;

  //     // All of the properties that can reference this element type
  //     var referencingElements;
  //     properties.forEach(function (property) {
  //       // :NOTE: using a substring match attr selector here to deal with IE "adding extra quotes in url() attrs"
  //       referencingElements = $svg.find('[' + property + '*="' + currentId + '"]');
  //       $svg.find('[style]').each(function(idx, styleEl){
  //         var reg = new RegExp('url\\s*\\(\\s*([\'\"])?#' + currentId + '\\1\\s*\\)', 'g')
  //         var style = $(this).attr('style')
  //         if(style.match(reg)){
  //            $(this).attr('style', style.replace(currentId,newId ))
  //         }
  //       })
  //       referencingElements.each(function(idx, referencingEl){
  //         $(referencingEl).attr(property, 'url(#' + newId + ')')
  //       })
  //     });
  //     // console.log(newId)
  //     $elementDefEl.attr('id', newId);
  //   });
  // });
  
  // Increment the injected count
  injectCount++;

  // Remove any unwanted/invalid namespaces that might have been added by SVG editing tools
  $svg.removeAttr('xmlns:a');


  // console.log(svg$.xml('svg'))
  $imgEl.replaceWith($(svg$.xml('svg')));
}

var PromiseRequest = Promise.method(function(url) {
  return new Promise(function(resolve, reject) { 
    var requestObj;
    if (url.indexOf("http://") == 0) {
        requestObj = http;
    }else if (url.indexOf("https://") == 0) {
        requestObj = https;
    }else{
      reject(new Error('invalid url protocol. Expected URL to start with http:// or https://'))
    }
    var request = requestObj.request(url, function(response) {
        // Bundle the result
        var result = {
            'httpVersion': response.httpVersion,
            'httpStatusCode': response.statusCode,
            'headers': response.headers,
            'body': '',
            'trailers': response.trailers,
        };

        // Build the body
        response.on('data', function(chunk) {
            result.body += chunk;
        });

        // Resolve the promise when the response ends
        response.on('end', function() {
            resolve(result);
        });
    });

    // Handle errors
    request.on('error', function(error) {
        console.log('Problem with request:', error.message);
        reject(error);
    });

    // Must always call .end() even if there is no data being written to the request body
    request.end();
  });
});
 

$('img.svg').each(function(idx, imgEl){
  var $imgEl = $(imgEl);
  var src = $imgEl.attr('src');

  if(! src) return;
  var src = src.trim();
  var promise;
  if(src.match(/^(http|https):\/\//)){
    promise = PromiseRequest(src)
      .then(function(res){
        return Promise.resolve(stampSVG($imgEl, res.body));
      });

  }else{
    var p = path.resolve(src);
    promise = fs.readFileAsync(p, 'utf-8')
      .then(function(str){
        return Promise.resolve(stampSVG($imgEl, str));
      });
  }
  promises.push(promise);
})



  Promise.all(promises)
  .then(function(){
    process.stdout.write('Finished injecting SVGs.');
    fs.writeFileSync(outputFile, $.html())
  })
  .catch(function(err){
    process.stderr.write(err.message + '\n' + err.stack + '\n');
  }).finally(function(){
    process.exit();
  })
