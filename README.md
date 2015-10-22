# nodeSVGInjector

## TL;DR;
    
    $ nodeSVGInjector index.html -o output.html


## Description
This modules allows you to inline SVGs in html pages with node.js. It's heavily inspired by (and a node port of) [SVGInjector](https://github.com/iconic/SVGInjector). The `evalScript`, `pngFallback`, `each(svg)` and `callback(count)` features of SVGInjector are missing. The last three may be implemented at some point if needed. Feel free to submit a pull request.

## Usage
Usage: 
    
    nodeSVGInjector [options] [input.html]

## Options:

  ### -o, --out
  The output file to write to. The defaults is `[filename].svginjected`

### `-o, --out`
The output file to write to. The defaults is `[filename].svginjected`

### `-c, --selector`
TCSS Selector for inlining SVGs. The default is 'img.svg'.

### `-v, --version`
Displays the current version


## License 
MIT

