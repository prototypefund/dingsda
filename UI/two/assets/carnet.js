// Default export is a4 paper, portrait, using milimeters for units

// TODO: add list of characters that break the layout and replace them e.g. "–" => "-"

console.log("carnet starting");

////////// PDF MAKING:

function toDataURL(url, callback) {
  var xhr = new XMLHttpRequest();
  xhr.onload = function() {
    var reader = new FileReader();
    reader.onloadend = function() {
      callback(reader.result);
    }
    reader.readAsDataURL(xhr.response);
  };
  xhr.open('GET', url);
  xhr.responseType = 'blob';
  xhr.send();
}

let pageNo = 0; // 0, 1 or 2 for pages 1-3 on CARNETATA forms
let linecount = 0;
let charsPerLine = 31;

let linesPerPage = [44,42,47]; // Page 1: 44 Page 2: 42 Page 3: 47--> make into Array!!!
let offsetTopPage = [0,9,13]; // Page 1: 0 Page 2: 13 Page 3: 13
let offsetLeftPage = [0,19,0]; // Page 1: 0 Page 2: 14 Page 3: 0

let sumItems = 0;
let sumWeight = 0;
let sumPrice = 0;


// main

function makepdf(imgData, textdataInput, coverdata)
{
  // replace problematic chars and (stringifiy to create cloned object)
  textdataInput = JSON.stringify(textdataInput).replace(/–/g,"-").replace(/–/g,"-");
  let textdata  = JSON.parse(textdataInput);

  let doc = new jsPDF();
  //doc.addFont('Courier.ttf', 'Courier', 'normal');
  doc.setFont('Courier');
  //doc.addFont('Courier');
  doc.setFontSize(10);
  if(textdata != "ERROR")
  {
    addCoverPage();
  }
  else {

  }
  if (imgData != undefined){
      doc.addImage(imgData[0],"JPEG",0,0);
  }

  function addCoverPage()
  {
      doc.setFontSize(9);
      if (imgData != undefined)
      {
          doc.addImage(imgData[3],"JPEG",0,0);
      }

      try
      {
        /*
        doc.text(coverdata.companyname, 28, 45);
        doc.text(coverdata.street1, 28, 49);
        doc.text(coverdata.street2, 28, 53);
        doc.text(coverdata.zipcodecity, 28, 57);
        */
        doc.setFontSize(8);
        doc.text("ACCORDING TO AUTHORITY / GEMAESS VOLLMACHT", 28, 80);
        doc.text("PROFESSIONAL EQUIPMENT / BERUFSAUSRUESTUNG", 28, 98);
      }
      catch(e)
      {
        doc.text("!!! No data provided see below for item data !!!", 28, 64);
      }

      doc.setFontSize(10);
      doc.addPage();

  }

  // - check if page break is needed and perform if so.
  function addPageIfNeeded()
  {
    if (linecount % linesPerPage[pageNo] == 0 && linecount != 0)
    {
      linecount = 0;
      console.log(linecount +" new page! "+ linecount % linesPerPage[pageNo]);
      // HERE ADD SUMS ON BOTTOM AND TOP (if not on page 0) before adding a new page
      printEndSums();
      // add new page
      pageNo++;
      if (pageNo > 2){pageNo = 1}; // rotate only between 1 and 2
      console.log(pageNo);
      doc.addPage();
      if (imgData != undefined){ doc.addImage(imgData[pageNo],"JPEG",0,0); }
      printHeaderSums();
    }
  }

  function printEndSums()
  {
    doc.text(String(sumItems), 95+offsetLeftPage[pageNo], 75+offsetTopPage[pageNo] +linesPerPage[pageNo]*4);
    doc.text(String(sumWeight), 110+offsetLeftPage[pageNo], 75+offsetTopPage[pageNo] +linesPerPage[pageNo]*4);
    doc.text(String(sumPrice), 129+offsetLeftPage[pageNo], 75+offsetTopPage[pageNo] +linesPerPage[pageNo]*4);
  }

  function printHeaderSums()
  {
    doc.text(String(sumItems), 95+offsetLeftPage[pageNo], 62+offsetTopPage[pageNo] );
    doc.text(String(sumWeight), 110+offsetLeftPage[pageNo], 62+offsetTopPage[pageNo] );
    doc.text(String(sumPrice), 129+offsetLeftPage[pageNo], 62+offsetTopPage[pageNo] );
  }


  //    loop over all items in textdata and make each into a line
  //    count items on a page and start new page if successfully
  //    check line length on description col and split into two lines if necessary

// TO DO:
//    - more than 2 lines possible (DONE)
//    - calculate weights and prices and item no per each and put into form
//    - if empty line with only description, make new line and dont try to calculate stuff ( gotta be done in the other script)

    textdata.forEach(function(item,i)
    {

      linecount++;
      addPageIfNeeded();

      ///* // CARNETATA Page
      let linepos = 70+offsetTopPage[pageNo] +linecount%linesPerPage[pageNo]*4;

          if (item.description != undefined){
            // CHECK IF PAGEBREAK WILL BE TRIGGERED:
          if (item.no != undefined){doc.text(item.no, 7+offsetLeftPage[pageNo], linepos);}
	        if (item.count != undefined){doc.text(item.count, 95+offsetLeftPage[pageNo], linepos); sumItems += parseInt(item.count)}
          if (item.weight != undefined){doc.text(item.weight, 110+offsetLeftPage[pageNo], linepos); item.weight = parseFloat(item.weight.split("kg")[0].split("g")[0]);if(Number.isNaN(item.weight)){item.weight = 0}; sumWeight = parseFloat((parseFloat(item.weight) + sumWeight).toFixed(3));}
          if (item.price != undefined){doc.text(item.price.replace("€","EUR"), 129+offsetLeftPage[pageNo], linepos); item.price = parseFloat(item.price.split("EUR")[0].split("€")[0].split("USD")[0].split("$")[0]); console.log(item.price);if(Number.isNaN(item.price)){item.price = 0}; sumPrice = parseFloat((parseFloat(item.price) + sumPrice).toFixed(2));}
          if (item.origin != undefined){doc.text(item.origin, 155+offsetLeftPage[pageNo], linepos);}
          if (item.description.length > charsPerLine)
          {
	      	//calculate the number of extra lines:
	      	let extralines = Math.ceil(item.description.length / charsPerLine)-1;
		console.log(extralines);
		doc.text(item.description.substr(0,charsPerLine), 25+offsetLeftPage[pageNo], linepos);

		for (let i = 0; i < extralines; i++)
		{

			linecount++;
			addPageIfNeeded();
			linepos = 70+offsetTopPage[pageNo] +linecount%linesPerPage[pageNo]*4;
			doc.text(item.description.substr((i+1)*charsPerLine,charsPerLine), 25+offsetLeftPage[pageNo], linepos);

		}
              //doc.text(item.description.substr(0,charsPerLine), 25+offsetLeftPage[pageNo], linepos);
              //linecount++;
              //addPageIfNeeded();
              //linepos = 70+offsetTopPage[pageNo] +linecount%linesPerPage[pageNo]*4;
              //doc.text(item.description.substr(charsPerLine), 25+offsetLeftPage[pageNo], linepos);

	}
          else
          {
              doc.text(item.description, 25+offsetLeftPage[pageNo], linepos);
          }

      }

      // console.log(item); // look at every item

    })

    // after last item:
    printEndSums();

    //doc.output('datauri');
    //doc.output('dataurlnewwindow');
    doc.save('carnetATA.pdf'); // this saves the pdf and downloads it

    // this will make the pdf visible in an iframe:
    var string = doc.output('datauristring');
    //var iframe = "<iframe src='http://localhost:8000/makepdf'></iframe>";
    //var iframe = "<iframe width='100%' height='90%' src='" + string + "'></iframe>"
    //$( "#iframe").attr("src",string);

    if (coverdata != undefined)
    {
      if (coverdata.autodownload != undefined)
      {
          doc.save('carnetATA.pdf'); // this saves the pdf and downloads it
      }
    }

    //reset global vars:
    pageNo = 0;
    linecount = 0;

    sumItems = 0;
    sumWeight = 0;
    sumPrice = 0;

  }



  function numberItems(rows)
  {
    //console.log(input);
    //rows = Object.keys(input).map((k) => input[k]); rows = rows[0];
    //rows = input["Sheet1"];

    // map the object into an array of arrays by col number instead of key(string):
    let keys = Object.keys(rows[0]);
    let output = [];
    rows.forEach(function(row, ind){
      let obj = [];
      keys.forEach((function(key){
        obj.push(row[key]);
      }));
      console.log(obj);
      output.push(obj);
    })
    //console.log(output); // output is here the array of arrays sorted by column

    //console.log(rows);
    console.log("number of rows in file: "+rows.length);

  // here every row should now look like this: {"no":"","description":"","count":"","weight":"","price":"","origin":}

    rows[0].no = 1; // set first item to number 1

    rows.forEach(
      function(item,i)
      {
          //console.log(item);
          if (item.description != undefined)
          {
                let ind = 1;
                let laufnr = 1;
                let newNum = 1;

                if (item.no == 1)
                {
                  laufnr = 1;
                  newNum = Number(item.count);
                }
                else {
                  laufnr = String(rows[i-1].no);
                  let ind = laufnr.indexOf("-");
                  newNum = Number(laufnr.substring(ind+1, laufnr.length))+Number(item.count);
                }

                if (item.count > 1)
                {

                  item.no = (newNum + 1 - item.count) + "-" + newNum;
                }
                else
                {
                  item.no = ""+newNum;
                }
                //console.log(item);

          }
      }
    )

    //console.log(rows);
    return rows;
  }

//

function renderCarnetATApdf(carnetArray)
{
  console.log(carnetArray); // includes the data for the pdf

  let carnetArrayNumbered = numberItems(carnetArray);
  console.log(carnetArrayNumbered);
  makepdf(undefined, carnetArrayNumbered, {companyname:"",street1:"",street2:"",zipcodecity:""});


}

function download()
  {
    console.log("download triggered");
    makepdf(undefined, carnetArrayNumbered, {companyname:"",street1:"",street2:"",zipcodecity:"",autodownload:true});

  }
