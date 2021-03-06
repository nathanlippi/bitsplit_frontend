// Dependencies:
// -- jquery, fitText
//
// TODO
// -- Store common selectors in variable

var CHART = (function()
{
  var is_intermission = false;

  var arc, pie, svg, circle, foreignObject, circleHTML;

  var chartData                          = [];
  var display_other_players_in_aggregate = false;
  var highlightFirstSegment              = false;
  var my_view                            = 0;

  var VIEWS = {
    WIN_CHANCE           : 0,
    PERCENT_CONTRIBUTION : 1,
    COMBINED             : 2
  };

  var IDS = {
    circleHTML       : "chartCircleHTMLBody",
    potprize         : "potprize",
    currentRoundSize : "currenrndsize",
    nextRoundTitle   : "nextRoundTitle",
    nextRoundTime    : "nextRoundTime",
  };

  var pot_prize, pot_title;
  var innerRadius_min, outerRadius;
  var width                         = 350;
  var height                        = width;

  function resize(outerRadius_local)
  {
    var ratio       = 0.625;

    if(typeof outerRadius !== "number") {
      outerRadius_local = width/2;
    }
    outerRadius = Math.floor(outerRadius_local);

    width  = Math.ceil(outerRadius*2);
    height = width;

    innerRadius_min  = Math.floor(outerRadius*ratio);
  }

  function sqr(x) { return x*x; }

  function get_class(d, i) {
    return "arc current-player";
  }

  function init(selector) {
    arc = d3.svg.arc();
    pie = d3.layout.pie()
      .sort(null);

    if(typeof selector !== "string") {
      selector = "body";
    }

    svg = d3.select(selector).append("svg")
      .attr("width", width)
      .attr("height", height)
      .attr("id", "piechart");

    circle = svg.append("circle")
       .attr("cx", outerRadius)
       .attr("cy", outerRadius)
       .attr("r", innerRadius_min)
       .attr("class", "chart_center")
       .attr("id", "chart_center");

    foreignObject = svg.append("foreignObject")
      .attr("id", "chart_fo");

    circleHTML =
      foreignObject.append("xhtml:body")
        .attr("id", IDS.circleHTML);

    var sel = "#"+IDS.circleHTML;
    $(sel).append("<div id='"+IDS.currentRoundSize+"'>CURRENT ROUND PRIZE</div>");
    $(sel).append("<div id='"+IDS.potprize+"'>...</div>");
    $(sel).append("<div id='"+IDS.nextRoundTitle+"'>Bitcoins Splitting In</div>");
    $(sel).append("<div id='"+IDS.nextRoundTime+"'>...</div>");
  }

   // chartData: [{contribution: 3, win_chance: 9} ...]
  function arcs(chartData)
  {
    // Make a copy
    var data = chartData.slice();

    var max_win_chance_out_of_1 = 0;
    var win_chance_total        = 0;
    data.forEach(function(item, i) {
      win_chance_total += item.win_chance;
    });

    data.forEach(function(item, i) {
      var wc_1 = item.win_chance / win_chance_total;

      item.win_chance_out_of_1 = wc_1;

      // Find the arc with the maximum chance of winning
      if(wc_1 > max_win_chance_out_of_1) {
        max_win_chance_out_of_1 = wc_1;
      }
    });

    var arc_len_attr = "contribution";
    if(my_view === VIEWS.WIN_CHANCE) {
      arc_len_attr = "win_chance";
    }
    var arc_lens = [];
    data.forEach(function(item, i) {
      // TODO: Pie should be limited depending on if 
      arc_lens.push(item[arc_len_attr]);
    });

    var arcs0 = pie(arc_lens);
    var i     = -1;
    var arc;

    var max_arc_out_of_1 = 0;
    arcs0.forEach(function(d, i) {
      d.angle_length          = d.endAngle - d.startAngle;
      d.angle_length_out_of_1 = d.angle_length/(2*Math.PI);

      if(d.angle_length_out_of_1 > max_arc_out_of_1) {
        max_arc_out_of_1 = d.angle_length_out_of_1;
      }
      if(d.angle_length_out_of_1 > max_arc_out_of_1) {
        max_arc_out_of_1 = d.angle_length_out_of_1;
      }
    });

    var max_win_chance = max_win_chance_out_of_1;

    var maxOuterRadius, minInnerRadius;
    var innerRadius_fn, outerRadius_fn;

    if(my_view === VIEWS.COMBINED) {
      maxOuterRadius = outerRadius;
      minInnerRadius = innerRadius_min;

      innerRadius_fn = function() { return innerRadius_min; };
      outerRadius_fn = getOuterRadius;
    }
    else if(my_view === VIEWS.PERCENT_CONTRIBUTION ||
            my_view === VIEWS.WIN_CHANCE)
    {
      maxOuterRadius = outerRadius;
      minInnerRadius = innerRadius_min;

      innerRadius_fn = function() { return innerRadius_min; };
      outerRadius_fn = function() { return outerRadius; };
    }

    var circle_area    = Math.PI*(sqr(maxOuterRadius) - sqr(minInnerRadius));
    var section_area   = circle_area*max_arc_out_of_1;
    var density        = max_win_chance/section_area;

    function getOuterRadius(arc_out_of_1, win_chance)
    {
      var arc_len = arc_out_of_1*maxOuterRadius;

      if(arc_out_of_1 === 0) {
        return minInnerRadius;
      }

      var radius = sqr(minInnerRadius) +
        (win_chance / (Math.PI*arc_out_of_1*density));
      radius = Math.ceil(Math.sqrt(radius));

      return radius;
    }

    for(var ii=0; ii< arcs0.length;ii++) {
      arc = arcs0[ii];
      arc.innerRadius = innerRadius_fn(arc.angle_length_out_of_1,
                          sqr(arc.angle_length_out_of_1));

      arc.outerRadius = outerRadius_fn(arc.angle_length_out_of_1,
         data[ii].win_chance_out_of_1); // TODO: This reference is far away

    }
    return arcs0;
  }

  function transition() {
    var my_data = get_my_data();

    svg
      .attr("width", width)
      .attr("height", height);

    circle
     .attr("r", innerRadius_min)
     .attr("cx", outerRadius)
     .attr("cy", outerRadius);

    var arcs    =
      svg.selectAll(".arc")
        .data(my_data);

    arcs
      .enter().append("g")
        .attr("class", "arc")
        .attr("transform", "translate(" + outerRadius + "," + outerRadius + ")")
        .append("path")
        .attr("d", arc)
        // store the initial angles
        // Not necessary to do each time, most likely
        .each(function(d, i) { this._current = d; });
    arcs
      .exit().remove();

    arcs
      .attr("transform", "translate(" + outerRadius + "," + outerRadius + ")");

    foreignObject
      .attr("width", width)
      .attr("height", width);

    // Have IDS.chartHTML take up this portion of the circle in height
    var circleHeightPortion = 0.6;
    var innerCircleTop      = outerRadius - innerRadius_min;

    // Center the box vertically.
    var sel = "#"+IDS.circleHTML;
    $(sel).css("top", innerCircleTop+(innerRadius_min*(1-circleHeightPortion))+"px");
    $(sel).css("left", innerCircleTop+"px");
    // Make the height of the inner box appropriate
    $(sel).css("height", innerRadius_min*2*circleHeightPortion+"px");
    $(sel).css("width", innerRadius_min*2+"px");

    // This only needs to be called... but after document.ready
    $("#"+IDS.currentRoundSize).fitText(1.6);
    $("#"+IDS.potprize).fitText(0.75);
    $("#"+IDS.nextRoundTitle).fitText(1.5);
    $("#"+IDS.nextRoundTime).fitText(0.75);

    // Should really be done with .enter???
    if(highlightFirstSegment) {
      $(".arc:eq(0)").attr("class", "arc current-player");
    }
    else {
      $(".arc:eq(0)").attr("class", "arc");
    }

    var path = d3.selectAll(".arc > path")
        .data(my_data);

    path.transition().duration(750).attrTween("d", arcTween);
  }

  // http://bl.ocks.org/mbostock/1346410
  //
  // Store the displayed angles in _current.
  // Then, interpolate from _current to the new angles.
  // During the transition, _current is updated in-place by d3.interpolate.
  function arcTween(a) {
    var i = d3.interpolate(this._current, a);
    this._current = i(0);
    return function(t) {
      return arc(i(t));
    };
  }

  // [{contribution: 3, win_chance: 9} ...]
  function get_my_data()
  {
    var modified_data = [];

    // Chart all, or chart only current user vs others?
    if(display_other_players_in_aggregate) {
      var chartData_copy = chartData.slice(0);
      var currentPlayer  = chartData_copy.shift();
      var otherPlayers   = {contribution: 0, win_chance: 0};

      chartData_copy.forEach(function(item) {
        otherPlayers.contribution        += item.contribution;
        otherPlayers.win_chance          += item.win_chance; 
      });
      modified_data[0] = currentPlayer;
      modified_data[1] = otherPlayers;
    }
    else {
      modified_data = chartData;
    }

    var my_data = arcs(modified_data);

    return my_data;
  }

  function setHighlightFirstSegment(should_highlight) {
    highlightFirstSegment = should_highlight;
  }

  // Initialize
  resize();

  return {
    init : init,
    setView : function(viewCode) {
      my_view = viewCode;
      this.refresh();
    },
    setDisplayOtherPlayersInAggregate : function(dopia) {
      display_other_players_in_aggregate = dopia;
      this.refresh();
    },
    setHighlightFirstSegment: setHighlightFirstSegment,
    setData : function(data) {
      chartData = data;
    },
    setPotPrize: function(amount)
    {
      if(is_intermission) return false;

      amount = "฿"+amount;
      $("#"+IDS.potprize).html(amount);
    },
    setNextRoundTime: function(pretty_time)
    {
      if(is_intermission) return false;

      $("#"+IDS.nextRoundTime).html(pretty_time);
    },
    refresh : function() {
      transition();
    },
    resize: function(outerRadius) {
      resize(outerRadius);

      transition();
    },
    setIntermission: function(is_intermission_param) {
      is_intermission = is_intermission_param;

      var ch = $("#"+IDS.circleHTML);
      if(is_intermission) {
        return ch.addClass("intermission");
      }
      ch.removeClass("intermission");
    },
    IDS: IDS,
    VIEWS : VIEWS
  };
})();
