// to do: exports module stuff


function startBarcode()
{

  Quagga.init({
      inputStream : {
        name : "Live",
        type : "LiveStream",
        target: document.querySelector('#barcodeviewport'),    // Or '#yourElement' (optional)
        constraints: {
          width: 960,
          height: 720,
          facingMode: "environment",
        }
      },
      decoder : {
        /*
         TO DO: fill readers from config or depending on which field has focus
        because UPC and EAN should be only in barcode or UPC EAN relevant fields
        */
        readers : ["ean_reader","upc_reader"],
        debug: {
          drawBoundingBox: true,
          drawScanline: true
        }
      }
    }, function(err) {
        if (err) {
            console.log(err);
            return
        }
        console.log("Barcode Quagga Initialization finished. Ready to start");
        Quagga.start();
    });
}


Quagga.lastResults = [];

Quagga.onDetected(function(result){
  //console.log(result.codeResult.code);
/*
 count and compare result.codeResult.code and if 10 of the same codes
are detected, call Quagga.stop() and return the codeResult including code and
format for further processing (e.g. putting it into Forms)
*/
  if (Quagga.lastResults.length < 10)
  {
    Quagga.lastResults.push(result.codeResult.code);
  }
  else
  {
    let nums = {};
    Quagga.lastResults.forEach(function(x) { nums[x] = (nums[x] || 0) + 1; });
    //console.log(nums);
    let sorted = Object.keys(nums)
      .sort(function(x,y){return nums[x]-nums[y]})
    let barcode = sorted[sorted.length-1] // THIS IS THE BARCODE TO BE RETURNED!
    //console.log(barcode);

    let bc_event = new CustomEvent(
    	"barcodeScanned",
    	{
    		detail: {
    			barcode: barcode,
    			time: new Date(),
    		},
    		bubbles: true,
    		cancelable: true
    	}
    );
    document.dispatchEvent(bc_event);

    Quagga.lastResults = []; // empty lastResults again
  }



})

Quagga.onProcessed(function(result) {
        var drawingCtx = Quagga.canvas.ctx.overlay,
            drawingCanvas = Quagga.canvas.dom.overlay;

        if (result) {
            if (result.boxes) {
                drawingCtx.clearRect(0, 0, parseInt(drawingCanvas.getAttribute("width")), parseInt(drawingCanvas.getAttribute("height")));
                result.boxes.filter(function (box) {
                    return box !== result.box;
                }).forEach(function (box) {
                    Quagga.ImageDebug.drawPath(box, {x: 0, y: 1}, drawingCtx, {color: "green", lineWidth: 2});
                });
            }

            if (result.box) {
                Quagga.ImageDebug.drawPath(result.box, {x: 0, y: 1}, drawingCtx, {color: "#00F", lineWidth: 2});
            }

            if (result.codeResult && result.codeResult.code) {
                Quagga.ImageDebug.drawPath(result.line, {x: 'x', y: 'y'}, drawingCtx, {color: 'red', lineWidth: 3});
            }
        }
    });

function stopBarcode()
{
  Quagga.stop();
}
