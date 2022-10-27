var w2v = (function() {
  const scaleNeuron = d3.scale.linear().domain([0.0, 1.0]).range([0, 255]);
  const scaleEdge = d3.scale.linear().domain([-5.5, 5.5]).range([0, 255]);
  
  const width = $("#w2v-vis").parent().width();
  const height = 976;
  const r = 10;
  const oneHotSize = 15;

  var corpus = "";
  var vectors = {}; 
  var data = [];

  var inputLayer = Array(oneHotSize).fill(0.0);
  var hiddenLayer = Array(3).fill(0.0);
  var outputLayer = Array(30).fill(0.0);

  var firstEdges = Array(inputLayer.length * hiddenLayer.length).fill({});
  var secondEdges = Array(hiddenLayer.length * outputLayer.length).fill({});

  var firstMatrix = [...Array(inputLayer.length)].map(x=>Array(hiddenLayer.length).fill(0));
  var secondMatrix = [...Array(hiddenLayer.length)].map(x=>Array(outputLayer.length).fill(0));

  var prevFirstMatrix = [...Array(inputLayer.length)].map(x=>Array(hiddenLayer.length).fill(0));   //last change in weights for momentum
  var prevSecondMatrix = [...Array(hiddenLayer.length)].map(x=>Array(outputLayer.length).fill(0));   //last change in weights for momentum

  d3.select('div#w2v-vis > *').remove();
  var nnSvg = d3.select('div#w2v-vis')
    .append("div")
    .append("svg")
    .attr("width", width)
    .attr("height", height)
    .attr("style", "background-color: #ADD7F6;");

  var textInput = nnSvg
    .append("g")
    .classed("input-text", true)
    .append("text");

  var textOutput1 = nnSvg
    .append("g")
    .classed("input-text", true)
    .append("text");

  var textOutput2 = nnSvg
    .append("g")
    .classed("input-text", true)
    .append("text");

  var tooltip = d3.select("body")
    .append("div")
    .style("padding", "5px")
    .style("background-color", "#84DCC6")
    .style("color", "white")
    .style("font-size", "16px")
    .style("position", "absolute")
    .style("z-index", "10")
    .style("visibility", "hidden")
    .text("");

  var nnInput = nnSvg.selectAll("g.input-neuron")
    .data(inputLayer)
    .enter()
    .append("g")
    .classed("input-neuron", true)
    .append("circle");

  var nnHidden = nnSvg.selectAll("g.hidden1-neuron")
    .data(hiddenLayer)
    .enter()
    .append("g")
    .classed("hidden1-neuron", true)
    .append("circle");

  var nnOutput = nnSvg.selectAll("g.hidden2-neuron")
    .data(outputLayer)
    .enter()
    .append("g")
    .classed("hidden2-neuron", true)
    .append("circle");

  var inputEdges = nnSvg.selectAll("g.input-edge")
    .data(firstEdges)
    .enter()
    .append("g")
    .classed("input-edge", true)
    .append("line");

  var hiddenEdges = nnSvg.selectAll("g.hidden-edge")
    .data(secondEdges)
    .enter()
    .append("g")
    .classed("hidden-edge", true)
    .append("line");

  $("#nn_errors").width = $("#training_data").width();
  $("#nn_errors").height = $("#training_data").width();
  let chart = new Chart($("#nn_errors"), {
    type: 'line',
    data: {
      labels: [],
      datasets: [{
        label: "Error",
        data: [],
        backgroundColor: '#ADD7F6',
        borderColor: '#0275D8',
        borderWidth: 1,
        fill: false
      }]
    },
    options: {
      elements: {
        line: {
          tension: 0
        }
      }
    }
  });

  var trace = {
    x: Array(oneHotSize).fill(0.0),  
    y: Array(oneHotSize).fill(0.0), 
    z: Array(oneHotSize).fill(0.0),
    text: Array(oneHotSize).fill(""),
    mode: 'markers',
    marker: {
      size: 5,
      line: {
        color: 'rgba(217, 217, 217, 0.14)',
        width: 0.5
      },
      color: '#84DCC6',
      opacity: 0.8
    },
    type: 'scatter3d'
  };

  const layout = {
    dragmode: true,
    height: $("#training_data").width(),
    width: $("#training_data").width(),
    margin: {l: 0, r: 0, b: 0, t: 0},
    scene: {
      camera: {
        eye: {x: 1, y: 1, z: 1}
      }
    }
  };

  let divPos = document.getElementById('positions');
  Plotly.newPlot(divPos, [trace], layout, {displayModeBar: false});

  function getPosY(i, len) {
    const mid = height / 2;
    const step = 15;
    const halfStep = step / 2;
    const numberOfNeuron = (len / 2);
    const startPos = mid - ((numberOfNeuron + (numberOfNeuron)) * step + halfStep);
    
    return startPos + (i * 2 * step);
  }

  function updateCharts(iter, errors) {
    chart.data.labels.push(iter);
    chart.data.datasets.forEach((dataset) => {
      dataset.data.push(errors);
    });
    chart.update();
  }

  function updateD3(x, y1, y2) {
    const sizeOfText = 24;
    textInput.text(x)
      .attr("x", 0)
      .attr("y", getPosY(0,1) + sizeOfText/2)
      .style("font-size", sizeOfText.toString()+"px")
      .style("color", "black");

    textOutput1.text(y1)
      .attr("x", 350)
      .attr("y", getPosY(oneHotSize/2,oneHotSize*2) + sizeOfText/2)
      .style("font-size", sizeOfText.toString()+"px")
      .style("color", "black");

    textOutput2.text(y2)
      .attr("x", 350)
      .attr("y", getPosY(oneHotSize+(oneHotSize/2),oneHotSize*2) + sizeOfText/2)
      .style("font-size", sizeOfText.toString()+"px")
      .style("color", "black");
      
    nnInput.data(inputLayer);
    nnInput.attr("cx", 125)
      .attr("cy", function (d, i) {
        return getPosY(i, inputLayer.length); 
      })
      .attr("r", r)
      .style("fill", function(d) {
        const c = Math.round(scaleNeuron(d)).toString(16).padStart(2, "0");
        return "#" + c + c + c;
      })
      .on("mouseover", function(d) { return tooltip.style("visibility", "visible"); })
      .on("mousemove", function(d) { return tooltip.text(d).style("top", (d3.event.pageY-10)+"px").style("left",(d3.event.pageX+10)+"px"); })
      .on("mouseout", function(d) { return tooltip.style("visibility", "hidden"); });

    nnHidden.data(hiddenLayer);
    nnHidden.attr("cx", 225)
      .attr("cy", function (d, i) {
        return getPosY(i, hiddenLayer.length); 
      })
      .attr("r", r)
      .style("fill", function(d) {
        const c = Math.round(scaleNeuron(d)).toString(16).padStart(2, "0");
        return "#" + c + c + c;
      })
      .on("mouseover", function(d) { return tooltip.style("visibility", "visible"); })
      .on("mousemove", function(d) { return tooltip.text(d).style("top", (d3.event.pageY-10)+"px").style("left",(d3.event.pageX+10)+"px"); })
      .on("mouseout", function(d) { return tooltip.style("visibility", "hidden"); });

    nnOutput.data(outputLayer);
    nnOutput.attr("cx", 325)
      .attr("cy", function (d, i) {
        return getPosY(i, outputLayer.length); 
      })
      .attr("r", r)
      .style("fill", function(d) {
        const c = Math.round(scaleNeuron(d)).toString(16).padStart(2, "0");
        return "#" + c + c + c;
      })
      .on("mouseover", function(d) { return tooltip.style("visibility", "visible"); })
      .on("mousemove", function(d) { return tooltip.text(d).style("top", (d3.event.pageY-10)+"px").style("left",(d3.event.pageX+10)+"px"); })
      .on("mouseout", function(d) { return tooltip.style("visibility", "hidden"); });

    inputEdges.data(firstEdges);
    inputEdges.attr("x1", 125 + r)
      .attr("y1", function (d) {
        return getPosY(d["i"], inputLayer.length); 
      })
      .attr("x2", 225 - r)
      .attr("y2", function (d) {
        return getPosY(d["j"], hiddenLayer.length); 
      })
      .attr("stroke", function(d) {
        // console.log(d["weight"]);
        const c = Math.round(scaleEdge(d["weight"])).toString(16).padStart(2, "0");
        return "#" + c + c + c;
      })
      .attr("stroke-width", 3)
      .on("mouseover", function(d) { return tooltip.style("visibility", "visible"); })
      .on("mousemove", function(d) { return tooltip.text(d["weight"]).style("top", (d3.event.pageY-10)+"px").style("left",(d3.event.pageX+10)+"px"); })
      .on("mouseout", function(d) { return tooltip.style("visibility", "hidden"); });

    hiddenEdges.data(secondEdges);
    hiddenEdges.attr("x1", 225 + r)
      .attr("y1", function (d) {
        return getPosY(d["i"], hiddenLayer.length); 
      })
      .attr("x2", 325 - r)
      .attr("y2", function (d) {
        return getPosY(d["j"], outputLayer.length); 
      })
      .attr("stroke", function(d) {
        // console.log(d["weight"]);
        const c = Math.round(scaleEdge(d["weight"])).toString(16).padStart(2, "0");
        return "#" + c + c + c;
      })
      .attr("stroke-width", 3)
      .on("mouseover", function(d) { return tooltip.style("visibility", "visible"); })
      .on("mousemove", function(d) { return tooltip.text(d["weight"]).style("top", (d3.event.pageY-10)+"px").style("left",(d3.event.pageX+10)+"px"); })
      .on("mouseout", function(d) { return tooltip.style("visibility", "hidden"); });
  }

  function highlightWords(x, y1, y2) {
    let corpus = $("#article").html();
    let tmp = corpus.split("<b>");
      
    tmp[0] = tmp[0].replace(/<[^>]*>?/gm, '');
    tmp[1] = tmp[1].replace(/<[^>]*>?/gm, '');
    
    if (y1 == "") {
      tmp[0] = tmp[0].replace(`${x} ${y2}`, `<b>${x} ${y2}</b>`);
    } else if (y2 == "") {
      tmp[1] = tmp[1].replace(`${y1} ${x}`, `<b>${y1} ${x}</b>`);
    } else {
      tmp[1] = tmp[1].replace(`${y1} ${x} ${y2}`, `<b>${y1} ${x} ${y2}</b>`);
    }

    $("#article").html(tmp[0] + tmp[1]);
  }

  function redrawPositions(idx, text) {
    trace.x[idx] = hiddenLayer[0];
    trace.y[idx] = hiddenLayer[1];
    trace.z[idx] = hiddenLayer[2];
    trace.text[idx] = text;
    Plotly.redraw('positions');
  }

  function sigmoid(x) {
    return 1 / (1 + Math.exp(-x));
  }

  function dsigmoid(y) {
    return y * (1 - y);
  }

  function feedforward(x) {
    x.forEach(function(ele, index) {
      inputLayer[index] = ele;
    });

    for (var i=0; i<hiddenLayer.length; i++) {
      var sum = 0.0;
      for (var j=0; j<inputLayer.length; j++) {
        sum += inputLayer[j] * firstMatrix[j][i];
      }
      hiddenLayer[i] = sigmoid(sum);
    }

    for (var i=0; i<outputLayer.length; i++) {
      var sum = 0.0;
      for (var j=0; j<hiddenLayer.length; j++) {
        sum += hiddenLayer[j] * secondMatrix[j][i];
      }
      outputLayer[i] = sigmoid(sum);
    }
  }

  function backpropagate(y, N=0.75, M=0.1) {
    var outputDeltas = Array(outputLayer.length).fill(0.0);
    var totalErrors = 0.0;
    y.forEach(function(ele, index) {
      var error = ele - outputLayer[index];
      totalErrors += Math.sqrt(Math.pow(error, 2));

      outputDeltas[index] = error * dsigmoid(outputLayer[index]);
    });

    var hiddenDeltas = Array(hiddenLayer.length).fill(0.0);
    for (var i=0; i<hiddenLayer.length; i++) {
      var error = 0.0;
      for (var j=0; j<outputLayer.length; j++) {
        error += outputDeltas[j] * secondMatrix[i][j];
      }

      hiddenDeltas[i] = dsigmoid(hiddenLayer[i]) * error;
    }

    for (var i=0; i<hiddenLayer.length; i++) {
      for (var j=0; j<outputLayer.length; j++) {
        const change = outputDeltas[j] * hiddenLayer[i];
        
        const index = secondEdges.findIndex(edge => (edge.i===i && edge.j===j));
        secondEdges[index].weight += N*change + M*prevSecondMatrix[i][j];

        secondMatrix[i][j] += N*change + M*prevSecondMatrix[i][j];
        prevSecondMatrix[i][j] = change;
      }
    }

    for (var i=0; i<inputLayer.length; i++) {
      for (var j=0; j<hiddenLayer.length; j++) {
        const change = hiddenDeltas[j] * inputLayer[i];

        const index = firstEdges.findIndex(edge => (edge.i===i && edge.j===j));
        firstEdges[index].weight += N*change + M*prevFirstMatrix[i][j];
        
        firstMatrix[i][j] += N*change + M*prevFirstMatrix[i][j];
        prevFirstMatrix[i][j] = change;
      }
    }

    return totalErrors / parseFloat(y.length);
  }

  function clean(corpus) {
    // corpus = corpus.replace(/\n/g, ' ');
    // corpus = corpus.replace(/  /g, '');
    // corpus = corpus.replace(/\./g, '');
    // corpus = corpus.replace(/,/g, '');
    
    return corpus.split(" ").filter((v, i, a) => v != "");
  }

  function getTrainingData(corpus, halfWinSize=1) {
    let data = [];
    for (let i = 0; i < corpus.length; i++) {
      let tmp = { "x": "", "y":[]};
      for (let j = i-halfWinSize; j < i+halfWinSize+1; j++) {
        if (j < 0 || j >= corpus.length) {
          tmp.y.push("");
        } else if (j == i) {
          tmp.x = corpus[j];
        } else {
          tmp.y.push(corpus[j]);
        }
      }
      data.push(tmp);
    }
    return data;
  }

  function getOneHotVector(corpus) {
    const unique = corpus.filter((v, i, a) => a.indexOf(v) === i);
    const total = unique.length;
    let oneHotVectors = {};
    for (let i = 0; i < total+1; i++) {
      let vector = Array(total+1).fill(0);
      vector[i] = 1;
      if (i == total) {
        oneHotVectors[""] = vector;
      } else {
        oneHotVectors[unique[i]] = vector;
      }
    }

    return oneHotVectors;
  }

  function visualizeError(iter, total_iter, errors) {
    $("#w2v_epoch").text(`epoch: ${iter} / ${total_iter}, error: ${errors}`);
  }

  function runRotation() {
    rotate('scene', Math.PI / 360);
    requestAnimationFrame(runRotation);
  }

  function rotate(id, angle) {
    var eye0 = divPos.layout[id].camera.eye
    var rtz = xyz2rtz(eye0);
    rtz.t += angle;
    
    var eye1 = rtz2xyz(rtz);
    Plotly.relayout(divPos, id + '.camera.eye', eye1)
  }

  function xyz2rtz(xyz) {
    return {
      r: Math.sqrt(xyz.x * xyz.x + xyz.y * xyz.y),
      t: Math.atan2(xyz.y, xyz.x),
      z: xyz.z
    };
  }

  function rtz2xyz(rtz) {
    return {
      x: rtz.r * Math.cos(rtz.t),
      y: rtz.r * Math.sin(rtz.t),
      z: rtz.z
    };
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  let publicScope = {};
  publicScope.train = async function(iter=20) {
    $("#w2v_training").prop('disabled', true);

    console.log(corpus);
    console.log(vectors);
    console.log(data);

    for (var it=0; it<iter; it++) {
      var errors = 0.0;
      for (var i=0; i<data.length; i++) {
        feedforward(vectors[data[i].x]);
        const y = vectors[data[i].y[0]].concat(vectors[data[i].y[1]]);
        errors += backpropagate(y);
        updateD3(data[i].x, data[i].y[0], data[i].y[1]);
        
        const index = Object.keys(vectors).indexOf(data[i].x);
        redrawPositions(index, data[i].x);

        highlightWords(data[i].x, data[i].y[0], data[i].y[1]);
        await sleep(65);
      }
      const avgErrors = errors / parseFloat(data.length);
      visualizeError(it+1, iter, avgErrors);
      updateCharts(it+1, avgErrors);
      console.log(`Errors in ${it} epoch: ${avgErrors}`);
    }

    runRotation();
  }

  publicScope.initNetwork = function() {
    corpus = clean($("#article").text());
    vectors = getOneHotVector(corpus); 
    data = getTrainingData(corpus);

    for (var x=0; x<inputLayer.length; x++) {
      for (var y=0; y<hiddenLayer.length; y++) {
        const w = Math.random();
        firstEdges[x*hiddenLayer.length + y] = {i: x, j: y, weight: w};
        firstMatrix[x][y] = w;
      }
    }

    for (var x=0; x<hiddenLayer.length; x++) {
      for (var y=0; y<outputLayer.length; y++) {
        const w = Math.random();
        secondEdges[x*outputLayer.length + y] = {i: x, j: y, weight: w};
        secondMatrix[x][y] = w;
      }
    }
  }

  return publicScope;
}());
