var personalStats;
var currentStats;
var socketConnectedUserIdNames = [];
var volumeLevel = 0.5;

/* Simple JavaScript Inheritance
 * By John Resig http://ejohn.org/
 * MIT Licensed.
 *
 * http://ejohn.org/blog/simple-javascript-inheritance
 */
(function() {
  var initializing = false, fnTest = /xyz/.test(function(){xyz;}) ? /\b_super\b/ : /.*/;

  // The base Class implementation (does nothing)
  this.Class = function(){};

  // Create a new Class that inherits from this class
  Class.extend = function(prop) {
    var _super = this.prototype;

    // Instantiate a base class (but only create the instance,
    // don't run the init constructor)
    initializing = true;
    var prototype = new this();
    initializing = false;

    // Copy the properties over onto the new prototype
    for (var name in prop) {
      // Check if we're overwriting an existing function
      prototype[name] = typeof prop[name] == "function" &&
        typeof _super[name] == "function" && fnTest.test(prop[name]) ?
        (function(name, fn){
          return function() {
            var tmp = this._super;

            // Add a new ._super() method that is the same method
            // but on the super-class
            this._super = _super[name];

            // The method only need to be bound temporarily, so we
            // remove it when we're done executing
            var ret = fn.apply(this, arguments);
            this._super = tmp;

            return ret;
          };
        })(name, prop[name]) :
        prop[name];
    }

    // The dummy class constructor
    function Class() {
      // All construction is actually done in the init method
      if ( !initializing && this.init )
        this.init.apply(this, arguments);
    }

    // Populate our constructed prototype object
    Class.prototype = prototype;

    // Enforce the constructor to be what we expect
    Class.prototype.constructor = Class;

    // And make this class extendable
    Class.extend = arguments.callee;

    return Class;
  };
})();

/*
 * CurrencyTracker
 *
 */
var CurrencyTracker = (function() {
  var self = this;

  self.acceptableTypes = {
    FAKE:    "fake",
    BITCOIN: "btc",
  };

  self.currencyType = self.acceptableTypes.FAKE;

  function setCurrentType(currencyType) {
    // TODO: Check that currencyType is of an acceptable type
    self.currencyType = currencyType;
  }

  function getCurrentType() {
    return self.currencyType;
  }

  return {
    setCurrentType  : setCurrentType,
    getCurrentType  : getCurrentType,
    acceptableTypes : acceptableTypes
  };
}());


/*
 * CurrencyModifier(s)
 *
 */
var CurrencyModifier = Class.extend({
  init: function(currencyType, currencyClass) {
    this.currencyType  = currencyType;
    this.currencyClass = currencyClass;
  },
  bet: function(amount, callback) {
    // Convert BTC-type to satoshis
    amount = to_satoshis(amount);
    socket.emit("bet:current_jackpot",
      {currencyType: this.currencyType, amount: amount});

    callback(null);
  },
  deposit: function(callback) {
  },
  withdraw: function(callback) {
    callback();
  }
});

var CurrencyModifierBSCurrency = CurrencyModifier.extend({
  init: function(currencyType) {
    this._super(currencyType, "bs");
  },
  deposit: function(callback) {
    var self = this;
    callback(null,
      {
        prompt: true,
        currencyType: self.currencyType,
        additional: {
          callback: function(amount) {
            socket.emit("user:add_to_balance",
              {currencyType: self.currencyType, amount: amount});
          }
        }
      });
  },
  withdraw: function(callback) {
    var self = this;
    callback(null,
      {
        prompt: false,
        currencyType: self.currencyType,
        additional: { message: "Sorry, fake money cannot be withdrawn."}
      });
  }
});

var CurrencyModifierVirtualCurrency = CurrencyModifier.extend({
  init: function(currencyType) {
    this._super(currencyType, "virtual");
  },
  deposit: function(callback) {
    var self = this;
    callback(null,
      {
        prompt       : false,
        currencyType : self.currencyType,
        additional   : {addr: personalStats.depositAddr}
      });
  },
  withdraw: function(callback) {
    var self = this;

    callback(null,
      {
        prompt: true,
        currencyType: self.currencyType,
        additional: {
          callback: function(addr, amount) {
	    // TODO: (not for here, actually)... socket should be able
	    // to send more than just error notifications.
            socket.emit("user:withdraw",
              {currencyType: self.currencyType, amount: amount, address: addr});
          }
        }
      });
  }
});

var CurrencyModifierFAKE = CurrencyModifierBSCurrency.extend({
  init: function() {
    this._super("fake");
  },
});
var CurrencyModifierBITCOIN = CurrencyModifierVirtualCurrency.extend({
  init: function() {
    this._super("btc");
  },
});


/*
 * BitSplit
 *
 */
var Currencies = (function() {
  var self = this;

  self.currencyTracker   = CurrencyTracker;
  self.currencyModifiers = (function() {
    var currencyModifierObjs = {};

    return {
      add: function(cmObj) {
        currencyModifierObjs[cmObj.currencyType] = cmObj;
      },
      get: function(currencyType) {
        if(typeof currencyModifierObjs[currencyType] === "object") {
          return currencyModifierObjs[currencyType];
        }
      }
    };
  }());

  self.currencyModifiers.add(new CurrencyModifierFAKE());
  self.currencyModifiers.add(new CurrencyModifierBITCOIN());

  function getCurrentCurrencyModifier() {
    return self.currencyModifiers.get(self.currencyTracker.getCurrentType());
  }

  function bet(amount, callback) {
    getCurrentCurrencyModifier().bet(amount, callback);
  }
  function deposit(callback) {
    getCurrentCurrencyModifier().deposit(callback);
  }
  function withdraw(callback) {
    getCurrentCurrencyModifier().withdraw(callback);
  }

  return {
    setType  : self.currencyTracker.setCurrentType,
    getType  : self.currencyTracker.getCurrentType,
    bet      : bet,
    deposit  : deposit,
    withdraw : withdraw
  };
}());

var currencyUI = (function(Currencies) {
  var self = this;
  self.Currencies = Currencies;

  function deposit() {
    self.Currencies.deposit(function(err, res) {
      if(res.prompt) {
        var msg = "How many (fake) bitcoins will you add to your balance?";

        alertify.prompt(msg, function (e, amount) {
            if (e) { // user clicked "ok"
              res.additional.callback(to_satoshis(amount));
            }
        }, 0);
      }
      else {
        alertify.alert("Your Bitcoin deposit address is: <b>"+res.additional.addr+"</b>");
      }
    });
  }

  function withdraw() {
    self.Currencies.withdraw(function(err, res) {
      if(res.prompt)
      {
        var msg_addr = "Which "+res.currencyType+" address would you like to withdraw to?";
        var msg_amt  = "Which "+res.currencyType+" amount?";

        alertify.prompt(msg_addr, function (e, addr) {
          if (!e) return false;

          alertify.prompt(msg_amt, function (e, amount) {
              if (!e) return false;

              return res.additional.callback(addr, amount);
          }, 0);
        }, "");
      }
      if(res.additional.message) {
        return alertify.alert(res.additional.message);
      }
    });
  }

  // bet, deposit, withdraw (get and set Type?)
  return {
    deposit  : deposit,
    withdraw : withdraw
  };
})(Currencies);

var BitSplit = {
  currency : Currencies,
  UI       : {
    currency: currencyUI
  }
};

var is_round_intermission = false;

function play_sound(src) {
  var audio  = new Audio(src);
  audio.volume = volumeLevel;
  audio.play();
}


// Refreshes our countdown timer
var lastTimeLeft;
function refreshCountDownTimer() {
    if(typeof currentStats === "undefined") return;
    var maxTimeLeft     = currentStats.round_duration;
    var next_split_ms   = window.next_split_ms;
    var currentTimeLeft =
      Math.floor((next_split_ms - new Date().getTime()));

    if(typeof window.next_split_ms !== "number") {
      return false;
    }

    if(typeof lastTimeLeft !== "number") {
      lastTimeLeft = currentTimeLeft;
    }

    // Update timer every second
    if(Math.abs((currentTimeLeft - lastTimeLeft) / 1000) >= 1)
    {
      lastTimeLeft = currentTimeLeft;

      var percentage = (1 - currentTimeLeft/maxTimeLeft)*100;
      $(".bigcounter").css("width", percentage.toString()+"%");

      if(!is_round_intermission) {
        set_time_left(Math.round(currentTimeLeft/1000));
      }
   }
}

function inspectlet_tag(tag_str_or_obj) {
  if(typeof __insp !== "object") return;
  __insp.push(["tagSession", tag_str_or_obj]);
}

$(document).ready(function() {
  var new_user_name_sel      = '#new_user_name';
  var new_user_create_sel    = '#new_user_create, #user_name_change';

  var tooltip_is_visible = false;
  var tooltip_title      = "";

  $(new_user_name_sel).tooltip(
    {
      trigger: "manual",
      title: tooltip_title,
      placement: "top"
    });

  $(new_user_name_sel).on("paste keyup", function() {
    var user_name = $(new_user_name_sel).val();
    user_name     = encodeURIComponent(user_name);

    $.get("/api/1/isUserNameAvailable/"+user_name, function(res)
    {
      if(typeof res.user_name !== "string") {
        return console.log("Malformed response.");
      }

      var name_now = $(new_user_name_sel).val();

      if(name_now !== res.user_name) {
        return console.log("Name request is an old one.");
      }
      if(!res.is_available)
      {
        var title_changed = tooltip_title !== res.msg;

        $(new_user_name_sel)
          .attr("title", res.msg)
          .tooltip('fixTitle');

        // It flashes if updates unnecessarily
        if(!tooltip_is_visible || title_changed) {
          $(new_user_name_sel)
            .tooltip("show");
        }
        tooltip_title      = res.msg;
        tooltip_is_visible = true;

        $(new_user_create_sel).addClass("disabled");

        return;
      }

      $(new_user_name_sel)
        .tooltip("hide");

      tooltip_is_visible = false;

      $(new_user_create_sel).removeClass("disabled");
    });
  });

  setInterval(refreshCountDownTimer, 100);

  $("#volume_slider_icon").click(function() {
    $("#volume_slider").toggle();
  });

  $(".referral_popup").click(function() {
    alertify.alert("Your referral URL is:<br/><b>https://bitsplit.it/?ref="+personalStats.user_id+"</b><br/><br/>You will receive 1000 satoshis for every user that signs up from a unique ip address!");
  });

  var vsSel = "#volume_slider";
  $(vsSel).noUiSlider({
    start: volumeLevel,
    range: {
      'min': 0,
      'max': 1
    }
  });
  $(vsSel).on("change", function() {
    volumeLevel = $(vsSel).val();
  });
});

function refresh_bet_buttons() {
  // Update all the bet buttons with matching amounts
  $(".btccost .btn").each(function(i, el)
  {
    var percentage = $(el).attr("percentage");

    var bet_amt_satoshis;
    if(percentage === "custom") {
      var bet_amt_btc  = $("#custom_bet_input").val();
      bet_amt_satoshis = to_satoshis(bet_amt_btc);
    }
    else {
      bet_amt_satoshis = get_bet_amount_from_percentage(percentage);
    }

    var sel = ".bet_buttons .btn[percentage='"+percentage+"']";
    if(is_round_intermission ||
       typeof personalStats === "undefined" ||
       typeof personalStats.balance === "undefined" ||
       bet_amt_satoshis > personalStats.balance ||
       bet_amt_satoshis <= 0 || isNaN(bet_amt_satoshis))
    {
      $(sel).addClass("disabled");
    }
    else {
      $(sel).removeClass("disabled");
    }

    if(bet_amt_satoshis === false || percentage === "custom") return;

    $(el).html(to_btc_str_with_style(bet_amt_satoshis));
  });
}

// percentage: 0-100
function get_bet_amount_from_percentage(percentage) {
  if(typeof currentStats === "undefined") return false;

  var prize = currentStats.prize;
  var bet_amt_satoshis = Math.round(prize*percentage/100);

  return bet_amt_satoshis;
}

function check_for_new_contributors(pastContributors, currentContributors)     {
  if(pastContributors.length >= currentContributors.length) {
    return [];
  }

  // There are more contributors than before
  function get_user_ids(contributors) {
    var user_ids = [];
    contributors.forEach(function(item, ii) {
      user_ids.push(item.user_id);
    });
    return user_ids;
  }
  var user_ids_current = get_user_ids(currentContributors);
  var user_ids_past    = get_user_ids(pastContributors);

  var new_user_ids = $(user_ids_current).not(user_ids_past).get();

  var new_users = [];
  currentContributors.forEach(function(item, ii) {
    if(new_user_ids.indexOf(item.user_id) > -1) {
      new_users.push(item);
    }
  });

  return new_users;
}

function set_pot_prize() {
  if(typeof currentStats === "undefined") return;

  CHART.setPotPrize(to_btc_str_with_style(currentStats.prize));
}

function set_time_left(seconds) {
  CHART.setNextRoundTime(seconds_to_pretty_time(seconds));
}

function refresh_current_stats(current_stats)
{
    var pastCurrentStats = $.extend(true, {}, currentStats);
    currentStats         = current_stats;

    refreshCountDownTimer();

    var pastContributors = typeof pastCurrentStats.contributors === "object" ?
      pastCurrentStats.contributors : [];
    var currentContributors = currentStats.contributors;

    var current_user_name = null;
    if(typeof personalStats !== "undefined") {
      current_user_name = personalStats.name;
    }

    var new_users         = check_for_new_contributors(
      pastContributors, currentContributors);

    new_users.forEach(function(item, ii) {
      var new_user_name = item.user.name;

      if(new_user_name != current_user_name) {
        alertify.log("<b>"+new_user_name+"</b> just joined the round!");
        play_sound('audio/door-open.mp3');
      }
    });

    var table_id      = "table#currentbets";
    var table_body_id = table_id+" tbody";
    $(table_body_id).html("");

    var retr             = current_stats.round_time_left;
    var latency          = 0; // Assumption
    window.next_split_ms = new Date().getTime()+retr-latency;

    set_pot_prize();

    refresh_bet_buttons();

    current_player_percent_win_chance = 0;
    current_player_contribution       = 0;

    var chartData   = []; // Put current player at beginning of the array
    var myChartItem = null;

    function add_table_row(
      name, user_id, percent_win_chance, contribution_btc, percent_contribution)
    {
        var class_names = (contribution_btc === 0) ?
          "player_inactive" : "player_active";

        if(percent_win_chance > percent_contribution)
          class_names += " advantage";
        else if(percent_win_chance < percent_contribution)
          class_names += " disadvantage";

        percent_win_chance   = percent_win_chance.toPrecision(3);
        percent_contribution = percent_contribution.toPrecision(3);

        var str  = "<tr user_id='"+user_id+"' class='"+class_names+"'>";
        str     += "<td>"+name+"</td>";
        str     += "<td>"+percent_win_chance+"%</td>";
        str     += "<td>"+btc_format_with_style(contribution_btc)+"</td>";
        str     += "<td>"+percent_contribution+"%</td>";
        str     += "</tr>";

        $(table_body_id).append(str);
    }

    var active_user_ids = [];

    for(var ii = 0; ii < current_stats.contributors.length; ii++)
    {
        var font_color = "bitcoin-symbol font-color-bitcoin";

        var contributor          = current_stats.contributors[ii];
        var contribution         = to_btc(contributor.contribution);
        var percent_contribution = (contributor.percent.total_contribution * 100);
        var percent_win_chance   = (contributor.percent.win_chance * 100);
        var user                 = contributor.user;
        var user_id              = user._id;

        active_user_ids.push(user_id);

        // Convert to string of specific length, for display
        percent_win_chance_str   = percent_win_chance.toPrecision(3);

        var chartItem =
          {win_chance: percent_win_chance, contribution: contribution};

        if(current_user_name === user.name) {
          current_player_percent_win_chance = percent_win_chance_str;
          current_player_contribution       = contribution;

          myChartItem = chartItem;
        }
        else {
          chartData.push(chartItem);
        }

        var row = add_table_row(user.name, user_id, percent_win_chance,
                                contribution, percent_contribution);
    }

    // var socketConnectedUserIdNames

    for(var user_id_temp in socketConnectedUserIdNames) {
      name_temp = socketConnectedUserIdNames[user_id_temp];

      // skip bc is active user
      if(active_user_ids.indexOf(user_id_temp) != -1) continue;

      add_table_row(name_temp, user_id_temp, 0, 0, 0);
    }

    // No current players
    // var no_participants   = "#current_participants_pane #no_participants";
    // var participant_count = ".current-participants-badge";
    // if(current_stats.contributors.length === 0) {
    //   // Hide table and show something else
    //   $(table_id).hide();
    //   $(no_participants).show();

    //   $(participant_count).html("");
    // }
    // else {
    //   $(no_participants).hide();
      $(table_id).show();

    //   $(participant_count).html(current_stats.contributors.length);
    // }

    var not_playing = "#my_current_stats #my_current_stats_inactive";
    var am_playing  = "#my_current_stats #my_current_stats_active";
    // Player is participating
    if(myChartItem !== null)
    {
      CHART.setHighlightFirstSegment(true);
      chartData.unshift(myChartItem);

      $(not_playing).hide();
      $(am_playing).show();
    }
    else
    {
      CHART.setHighlightFirstSegment(false);

      $(am_playing).hide();
      $(not_playing).show();
    }

    if(!chartData.length) {
      chartData = [{win_chance: 1, contribution: 1}];
    }

    CHART.setData(chartData);
    CHART.refresh();

    $(".my_win_chance").html(current_player_percent_win_chance);
    $(".my_contribution").html(btc_format_with_style(current_player_contribution));
}

function new_round () {
  is_round_intermission = false;
  CHART.setIntermission(false);

  refresh_bet_buttons();

  var svg = document.querySelector('svg#piechart');
  var flip_classes = 'animated flip';

  $("#"+CHART.IDS.currentRoundSize).html('CURRENT ROUND PRIZE');
  $("#"+CHART.IDS.nextRoundTitle).html('Bitcoins Splitting In');

  alertify.success("<b>New round starting!</b>");
  lunar.addClass(svg, flip_classes);
  setTimeout(function() {
    lunar.removeClass(svg, flip_classes);
  }, 2000);

  set_pot_prize();

  $('#bg').css('overflow','overflow-y'); 
  
  $(".bitsplitbetnav").removeClass('bounceOutDown');
  $(".bitsplitbetnav").addClass('animated bounceInUp');
  
  $("#bitsplitnav").removeClass('animated bounceOutUp');  
  $("#bitsplitnav").addClass('animated bounceInDown');

  $('.yourstats').removeClass('animated bounceOutLeft');
  $('.yourstats').addClass('animated bounceInLeft');

  $('#current_participants_pane').removeClass('animated bounceOutRight');
  $('#current_participants_pane').addClass('animated bounceInRight');

  // $("#sidebar").removeClass('animated bounceOutLeft');
  // $("#sidebar").removeClass('animated bounceInLeft');
}

function end_round(past_winner_data)
{
  is_round_intermission = true;
  CHART.setIntermission(true);

  refresh_bet_buttons();

  var jackpot_id                 = past_winner_data.jackpot_id;

  if(past_winner_data.user === null) { // No winner

  }
  else { // There was a winner

    var user_name                  = past_winner_data.user.name;
    var user_contribution_satoshis = past_winner_data.contribution;
    var winnings                   = past_winner_data.disbursements.winner;

    var presel = "#"+CHART.IDS.circleHTML+".intermission ";
    $(presel+"#"+CHART.IDS.currentRoundSize).html('Congratulations!');
    $(presel+"#"+CHART.IDS.potprize).html(user_name);
    $(presel+"#"+CHART.IDS.nextRoundTitle).html('YOU WIN');
    $(presel+"#"+CHART.IDS.nextRoundTime).html("฿"+to_btc_str_with_style(winnings));
  }
  
  var msg = "<b>Round Over!</b>";
  
  var svg          = document.querySelector('svg#piechart');
  var flip_classes = 'animated flip';

  lunar.addClass(svg, flip_classes);
  setTimeout(function() {
    lunar.removeClass(svg, flip_classes);
  }, 2000);

  $('#bg').css('overflow','none');


  $(".bitsplitbetnav").addClass('animated bounceOutDown');
  $("#bitsplitnav").addClass('animated bounceOutUp');
  // $("#sidebar").addClass('animated bounceOutLeft');
  $('.yourstats').addClass('animated bounceOutLeft');
  $('#current_participants_pane').addClass ('animated bounceOutRight');

  // TODO: If there was a winner, highlight the row in the table, switch to that
  // table.
  
  alertify.log(msg, "", 4000);
}

function refresh_past_winners(past_winners)
{
    var table_id = "table#pastwinners tbody";
    $(table_id).html("");

    var max_rows = 7;
    for(var ii = 0; ii < past_winners.length && ii < max_rows; ii++)
    {
        var jackpot = past_winners[ii];
        var dsbs    = jackpot.disbursements;
        var user    = {name: ""};

        if(typeof jackpot.user !== "undefined") {
          user = jackpot.user;
        }

        var win_or_lose = "win";
        if(jackpot.contribution === dsbs.winner) {
            win_or_lose = "neutral";
        } else if(jackpot.contribution > dsbs.winner) {
            win_or_lose = "lose";
        }

        var str  = "<tr>";
        str     += "<td class='bitcoin-symbol font-color-bitcoin-neutral'>"+to_btc_str_with_style(dsbs.total)+"</td>"; // Size
        str     += "<td>"+user.name+"</td>"; // Winner name
        str     += "<td class='bitcoin-symbol font-color-bitcoin-neutral'>"+to_btc_str_with_style(jackpot.contribution)+"</td>"; // Winner contribution

        // Disbursements
        str     += "<td class='bitcoin-symbol font-color-bitcoin-"+win_or_lose+"'>"+to_btc_str_with_style(dsbs.winner)+"</td>";
        str     += "<td class='bitcoin-symbol font-color-bitcoin-neutral'>"+to_btc_str_with_style(dsbs.next_jackpot)+"</td>"; // Next Jackpot
        str     += "<td class='bitcoin-symbol font-color-bitcoin-neutral'>"+to_btc_str_with_style(dsbs.house)+"</td>"; // House
        str     += "</tr>";

        $(table_id).append(str);
    }

     $("#bitsplitgames").addClass('animated fadeIn');
}

function to_btc(satoshis) {
  return satoshis/Math.pow(10,8);
}
function btc_format(btc_num)
{
  btc = btc_num.noExponents();

  // If does not have dot, add one.
  if(btc.indexOf(".") === -1) {
    btc += ".0";
  }
  var required_digits_after_dot = 8;
  var num_digits_after_dot      = btc.length - btc.indexOf(".") - 1;
  var diff                      = required_digits_after_dot - num_digits_after_dot;

  // Add missing digits
  // http://stackoverflow.com/questions/1877475/repeat-character-n-times
 if(diff > 0) {
    btc += Array(diff+1).join("0");
  }
  return btc;
}

// Essentially makes the satoshis number darker, and the BTC numbers lighter
// So with the following number:
// 0.00150000
// Lighter: 0.00
// Darker : 150000
function btc_format_with_style(btc_num) {
  btc = btc_format(btc_num);

  if(btc_num <= 0) {
    lighter = btc;
    darker  = "";
  }
  else {
    var regex = /^([0.]*)([1-9][0-9.]*)?$/;
    match = regex.exec(btc);

    lighter = match[1];
    darker  = match[2];
  }
  return "<span class='btc_lighter'>"+lighter+"</span>"+darker;
}

// BTC formatted to all 8 digits
function to_btc_str(satoshis) {
  var btc_num = to_btc(satoshis);
  return btc_format(btc_num);
}
function to_btc_str_with_style(satoshis) {
  var btc_num = to_btc(satoshis);
  return btc_format_with_style(btc_num);
}

function to_satoshis(btc) {
  return Math.round(btc*Math.pow(10,8));
}

function update_personal_stats(personal_stats) {
  personalStats = personal_stats;

  var currencyType = personalStats.currencyType;
  var balance  = 0;
  var password = "";
  var name     = "";

  BitSplit.currency.setType(currencyType);

  if(personalStats.name !== null) {
    var user_id = personalStats.user_id;
    balance     = personalStats.balance;
    password    = personalStats.password;
    name        = personalStats.name;

    mixpanel.identify(user_id);

    inspectlet_tag(
      {user_id: user_id, user_name: name, last_balance: balance});
  }
  $(".my_balance").html(to_btc_str_with_style(balance));
  refresh_bet_buttons();

  $("#password").html(password);
  $(".my_user_name").html(name);

  // TODO: DRY
  var sel = "a.btn.btn-currency";
  $(sel).removeClass("active");
  $(sel+"."+currencyType).addClass("active");
}

var user = {
  create: function(user_name) {
    socket.emit("user:create", user_name);
    inspectlet_tag({user_create: user_name});
  },
  change_name: function(new_user_name) {
    socket.emit("user:change_name", new_user_name);
    inspectlet_tag("user_change_name");
  },
  login: function(user_name, password) {
    socket.emit("user:login", {user_name: user_name, password: password});
    inspectlet_tag({login_attempt: ""});
  }
};

var temp = {
  login: function() {
    alertify.prompt("What is your user name?", function (e, user_name) {
      if (!e) {
        inspectlet_tag({login_attempt: "incomplete:no_name"});
        return false;
      }

      alertify.prompt("What is your password?", function (e, password) {
          if (!e) {
            inspectlet_tag({login_attempt: "incomplete:no_pass"});
            return false;
          }

          user.login(user_name, password);
      }, "");
    }, "");
  },
  toggle_password_visibility: function() {
    var selToggle      = "#toggle-password-visibilty";
    var selPass        = "#password";
    var invisibleClass = "invisible";

    if($(selPass).hasClass(invisibleClass)) {
      $(selPass).removeClass(invisibleClass);
      $(selToggle).html("hide");
    }
    else {
      $(selPass).addClass(invisibleClass);
      $(selToggle).html("show");
    }
  }
};

function seconds_to_pretty_time(time_seconds) {
    var m = 0;
    var s = 0;
    if(time_seconds > 0) {
      m = Math.floor(time_seconds / 60);
      s = time_seconds - m*60;
    }
    return zeroPad(m, 2)+":"+zeroPad(s, 2);
}
function zeroPad(num, places) {
  var zero = places - num.toString().length + 1;
  return new Array(+(zero > 0 && zero)).join("0") + num;
}

/*
 * Misc Scripts (document ready, etc.)
 *
 */
$(document).ready(function() {
  // $('#bitsplitgames').royalSlider({
  //    controlNavigation : 'bullets'
  //  });

var svg = document.querySelector('svg#piechart');

  $(window).resize(function()
  {
    $('#gameslider').css(
    {
      // position: 'absolute',
      // width:'100%'
    });

    $('#gameslider').css(
    {
      // left: ($(window).width() - $('#gameslider').outerWidth()) / 2,
      paddingTop:( (($(window).height()) / 2 ) - 210)
    });
  });

  // call `resize` to center elements
  $(window).resize();
  // Fade overlay which hides the jumble before royalSlider is activated.
  // $(".overlay-solid").fadeOut(300);

//   $("div#endofround").center(true);
// $("#gameslider").center(true);
  
  $('#bg').addClass('animated fadeIn');

  var sel = "div.betchart";
  CHART.init(sel);

  setTimeout(function() {
    var bs3_size = findBootstrapEnvironment();

    var r = 150;
    switch(bs3_size) {
      case 'xs':
        r = 150;
        break;
      case 'sm':
        r = 180;
        break;
      case 'md':
        r = 190;
        break;
      case 'lg':
        r = 225;
        break;
    }
    CHART.resize(r);
  }, 1000);


  $('.overlay-solid').addClass('animated fadeOut').delay(11300);
});

$("#deposit").on("click", function(e) {
  e.preventDefault();
  BitSplit.UI.currency.deposit();
});
$("#withdraw").on("click", function(e) {
  e.preventDefault();
  BitSplit.UI.currency.withdraw();
});

$(".bet_buttons").on("click", ".btn", function() {
  if(typeof currentStats === null) return false;

  var percentage = $(this).attr("percentage");
  var sel        = ".btccost .btn[percentage='"+percentage+"']";
  var amt        = $("#custom_bet_input").val();

  if(percentage !== "custom") {
    amt = to_btc(get_bet_amount_from_percentage(percentage));
  }

  // TODO: Test if is number
  BitSplit.currency.bet(amt, function(err, res) {
    var msg = "Placing bet: "+to_btc_str_with_style(to_satoshis(amt));
    alertify.success(msg, "", 2000);

    inspectlet_tag("placed_bet");
  });
});

// Will update the 'Custom Bet' button when you input a value.
$(".btccost .btn").on("paste keyup change", "input", function() {
  refresh_bet_buttons();
});

var sel = "a.btn.btn-currency";
$(sel).click(function(e) {
  $(sel).removeClass("active");
  $(this).addClass("active");
});

$("#login form").submit(function(e) {
  e.preventDefault();
  user.create($('#new_user_name').val());
});

var user_name_change_btn = "#user_name_change";
$("#new_user_name").keyup(function(e) { // Submit on enter
  if(e.keyCode != 13) return;
  e.preventDefault();
  $(user_name_change_btn).click();
});
$(user_name_change_btn).click(function(e) {
  user.change_name($('#new_user_name').val());
  $("#name_change_modal").modal("hide"); // TODO: DRY
});

function login_form_hide() {
  var sels = "#login,.overlay";
  $(sels).hide();
}

// http://stackoverflow.com/questions/16139452/how-to-convert-big-negative-scientific-notation-number-into-decimal-notation-str
Number.prototype.noExponents= function() {
    var data= String(this).split(/[eE]/);
    if(data.length== 1) return data[0]; 

    var  z= '', sign= this<0? '-':'',
    str= data[0].replace('.', ''),
    mag= Number(data[1])+ 1;

    if(mag<0){
        z= sign + '0.';
        while(mag++) z += '0';
        return z + str.replace(/^\-/,'');
    }
    mag -= str.length;  
    while(mag--) z += '0';
    return str + z;
};


////////////////////////////////////////////////////////////////
// Chat stuff

var chat_sel = "#chat_modal";
$("#chat_close").click(function() {
  $(chat_sel).modal("hide");
  $('#myTab a[href="#home"]').tab('show');
});
$("#account_show").click(function() {
  var sel = "#account_modal";
  $(sel).modal({show: true});
});

$("#chat_show").click(function() {
  var sel = "#chat_modal";
  $(sel).modal({show: true});
  setTimeout(scroll_chat_to_bottom, 250);
});

$("#past_winners_show").click(function() {
  var sel = "#past_winners_pane";
  $(sel).toggle();
});

$("#edit_user_name").click(function() {
  $("#name_change_modal").modal('show');
});

$("#btn-chat").click(function() {
  send_chat_msg();
});

$("#btn-input").keyup(function (e) {
  if (e.keyCode == 13) { // Enter
    send_chat_msg();
  }
});

function send_chat_msg()
{
  var sel = "#btn-input";
  var msg = $(sel).val();

  $(sel).val("");
  socket.emit("user:send_chat_message", {msg: msg});
  inspectlet_tag({last_chat_message: msg});
 }


var chat_message_count = 0;
function add_message_to_chat(user_name, message) {
  var str;

  str  = "<li class='left clearfix'>";
  str += "<div class='chat-body clearfix'>";
  str += "<div class='header'><span class='primary-font'>"+user_name+"</span></div>";
  str += "<p>"+message+"</p>";
  str += "</div>";
  str += "</li>";

  $(chat_body_sel).append(str);
  scroll_chat_to_bottom();

  if(!is_chat_open()) {
    chat_message_count++;
    update_chat_badge();
  }
}

$("#chat_show").click(function() {
  chat_message_count = 0;
  update_chat_badge();

  // Hopefully chat is shown after .1 second
  setTimeout(scroll_chat_to_bottom, 100);

});

var chat_body_sel = "#chat_body";

function scroll_chat_to_bottom() {
  // Basic scroll chat to bottom when message arrives.
  // TODO: Test how this works with scrolling through to look at past messages.
  var height = $(chat_body_sel).height();

  if(height) {
    $("#chat .panel-body").animate({scrollTop: height});
  }
}
function is_chat_open() {
  return $(chat_body_sel).height() > 0;
}
function update_chat_badge() {
  var txt = "";
  if(chat_message_count > 0) {
    txt = chat_message_count;
  }
  $(".chat-badge").html(txt);
}

function findBootstrapEnvironment() {
  var envs = ['xs', 'sm', 'md', 'lg'];

  $el = $('<div>');
  $el.appendTo($('body'));

  for (var i = envs.length - 1; i >= 0; i--) {
    var env = envs[i];

    $el.addClass('hidden-'+env);
    if ($el.is(':hidden')) {
      $el.remove();
      return env;
    }
  }
}

$('#sidebar').affix();
