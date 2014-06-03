var personalStats;
var currentStats;

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
        var amount =
          window.prompt("How many (fake) bitcoins will you add to your balance?", 0);
        res.additional.callback(to_satoshis(amount));
      }
      else {
        alert("Your Bitcoin deposit address is: "+res.additional.addr);
      }
    });
  }

  function withdraw() {
    self.Currencies.withdraw(function(err, res) {
      if(res.prompt) {
        var addr = window.prompt("Which "+res.currencyType+" address would you like to withdraw to?");
        var amount = window.prompt("Which "+res.currencyType+" amount?");
        return res.additional.callback(addr, amount);
      }
      return alert(res.additional.message);
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

bootstrap_alert = {};
bootstrap_alert.custom = function(type, message, fadeout_ms) {
  console.log("CALLING W/ MSG: "+message);

  if(typeof fadeout_ms !== "number") {
    fadeout_ms = 4000;
  }

  var sel = "#alert";
  if(!$(sel).length) {
    $("body").append("<span id='alert'></span>");
  }

  // TODO: Sounds like when two of these are called close together there will be
  // extra popups.
  $(sel).html('<div class="alert alert-'+type+' alert-dismissable"><button type="button" class="close" data-dismiss="alert" aria-hidden="true">&times;</button><span>'+message+'</span></div>')
    .delay(200)
    .fadeIn()
    .delay(fadeout_ms)
    .fadeOut();
};
bootstrap_alert.warning = function(message, fadeout_ms) {
  bootstrap_alert.custom("danger", message, fadeout_ms);
};
bootstrap_alert.success = function(message, fadeout_ms) {
  bootstrap_alert.custom("success", message, fadeout_ms);
};

$(document).ready(function() {
  var new_user_name = '#new_user_name';
  $(new_user_name).on("paste keyup", function() {
    var user_name = $(new_user_name).val();

    $.get("/api/1/isUserNameAvailable/"+user_name, function(res)
    {
      if(typeof res.user_name !== "string") {
        return console.log("Malformed response.");
      }

      var name_now = $(new_user_name).val();
      if(name_now !== res.user_name) {
        return console.log("Name request is an old one.");
      }
      if(!res.is_available)
      {
        $(new_user_name)
          .attr("title", res.msg)
          .tooltip('fixTitle')
          .tooltip("show")
          .removeClass("has-success")
          .addClass("has-error");

        return;
      }
      $(new_user_name)
        .tooltip("hide")
        .removeClass("has-error")
        .addClass("has-success");
    });
  });

  // Refreshes our countdown timer
  var maxTimeLeft, lastTimeLeft;
  setInterval(function() {
      var next_split_ms   = window.next_split_ms;
      var currentTimeLeft =
        Math.floor((next_split_ms - new Date().getTime()));

      if(typeof window.next_split_ms !== "number") {
        return false;
      }

      if(typeof lastTimeLeft !== "number") {
        lastTimeLeft = currentTimeLeft;
      }
      if(typeof maxTimeLeft !== "number") {
        maxTimeLeft = currentTimeLeft;
      }

      // Reset max time left to accomodate changing round lengths.
      if(currentTimeLeft > lastTimeLeft) {
        maxTimeLeft = currentTimeLeft;
      }
      lastTimeLeft = currentTimeLeft;

      var percentage = (1 - currentTimeLeft/maxTimeLeft)*100;
      $(".bigcounter").css("width", percentage.toString()+"%");

      $("#nextRoundTime").html(seconds_to_pretty_time(Math.round(currentTimeLeft/1000)));

  }, 30);
});


function refresh_bet_buttons() {
  // Update all the bet buttons with matching amounts
  if(typeof currentStats === null) return false;

  var prize = currentStats.prize;

  $(".btccost .btn").each(function(i, el) {
    var percentage       = $(el).attr("percentage");

    if(percentage === "custom")
      return;

    var bet_amt_satoshis = Math.round(prize*percentage/100);

    $(el).html(to_btc_str(bet_amt_satoshis));
  });
}

function refresh_current_stats(current_stats)
{
    currentStats = current_stats;

    var table_id = "table#currentbets tbody";
    $(table_id).html("");

    var trts             = current_stats.time_remaining_to_split;
    var latency          = 150; // Assumption
    window.next_split_ms = new Date().getTime()+trts-latency;

    var current_winning_contribution = 0;
    if(current_stats.contributors[0]) {
        current_winning_contribution = current_stats.contributors[0].contribution;
    }
    $("#current-winning-contribution").html("<i class='fa fa-btc'></i>"+to_btc_str(current_winning_contribution));
    $("#jackpot-amount").html("<i class='fa fa-btc'></i>"+to_btc_str(current_stats.jackpot));
    $("#potprize").html("<i class='fa fa-btc'></i>"+to_btc_str(current_stats.prize));

    refresh_bet_buttons();

    var current_user = personalStats.name;
    current_player_percent_win_chance = 0;
    current_player_contribution       = 0;

    var chartData   = []; // Put current player at beginning of the array
    var myChartItem = null;

    var max_rows = 7;
    for(var ii = 0; ii < current_stats.contributors.length && ii < max_rows; ii++)
    {
        var font_color = "bitcoin-symbol font-color-bitcoin";

        var contributor          = current_stats.contributors[ii];
        var contribution         = to_btc(contributor.contribution);
        var percent_contribution = (contributor.percent.total_contribution * 100);
        var percent_win_chance   = (contributor.percent.win_chance * 100);
        var user                 = contributor.user;

        var font_odds   = "font-color-bitcoin-lose";
        var odds_symbol = "<";
        if(percent_win_chance > percent_contribution) {
            font_odds   = "font-color-bitcoin-win";
            odds_symbol = ">";
        }
        else if(percent_win_chance === percent_contribution) {
            font_odds   = "font-color-bitcoin-neutral";
            odds_symbol = "=";
        }

        // Convert to string of specific length, for display
        percent_win_chance   = percent_win_chance.toPrecision(3);
        percent_contribution = percent_contribution.toPrecision(3);

        var chartItem =
          {win_chance: percent_win_chance, contribution: contribution};

        if(current_user === user.name) {
          current_player_percent_win_chance = percent_win_chance;
          current_player_contribution       = contribution;

          myChartItem = chartItem;
        }
        else {
          chartData.push(chartItem);
        }

        var str  = "<tr>";
        str     += "<td>"+user.name+"</td>";
        str     += "<td>"+percent_win_chance+"%</td>";
        str     += "<td>"+btc_format(contribution)+"</td>";
        str     += "<td>"+percent_contribution+"%</td>";
        str     += "</tr>";

        $(table_id).append(str);
    }

    if(myChartItem !== null)
    {
      CHART.setHighlightFirstSegment(true);
      chartData.unshift(myChartItem);
    }
    else
    {
      CHART.setHighlightFirstSegment(false);
    }

    if(!chartData.length) {
      chartData = [{win_chance: 1, contribution: 1}];
    }

    CHART.setData(chartData);
    CHART.refresh();

    $(".my_win_chance").html(current_player_percent_win_chance);
    $("#my_contribution").html(btc_format(current_player_contribution));
}

// Assuming that this is the end of the round when it is called
// Need to set up a new event
// TODO: Actually we only need the id of the finished round...
function end_round(end_round_object) {
  // Based on winner, etc., different message will be displayed
  var sel = "#endofround";
  var sel_content = sel+" .modal-body";

  $(sel_content).html("<h1>Round Over!</h1>");
  $(sel).modal({show: true, backdrop: false});

  // TODO: If there was a winner, highlight the row in the table, switch to that
  // table.
  var timeout_ms = 3000;
  setTimeout(function() {
    $(sel).modal('hide');
  }, timeout_ms);
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
        str     += "<td class='bitcoin-symbol font-color-bitcoin-neutral'>"+to_btc_str(dsbs.total)+"</td>"; // Size
        str     += "<td>"+user.name+"</td>"; // Winner name
        str     += "<td class='bitcoin-symbol font-color-bitcoin-neutral'>"+to_btc_str(jackpot.contribution)+"</td>"; // Winner contribution

        // Disbursements
        str     += "<td class='bitcoin-symbol font-color-bitcoin-"+win_or_lose+"'>"+to_btc_str(dsbs.winner)+"</td>";
        str     += "<td class='bitcoin-symbol font-color-bitcoin-neutral'>"+to_btc_str(dsbs.next_jackpot)+"</td>"; // Next Jackpot
        str     += "<td class='bitcoin-symbol font-color-bitcoin-neutral'>"+to_btc_str(dsbs.house)+"</td>"; // House
        str     += "</tr>";

        $(table_id).append(str);
    }
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

// BTC formatted to all 8 digits
function to_btc_str(satoshis) {
  var btc_num = to_btc(satoshis);
  return btc_format(btc_num);
}

function to_satoshis(btc) {
  return Math.round(btc*Math.pow(10,8));
}

function change_currency_type(currencyType) {
  socket.emit("user:change_currency_type", currencyType);
  // TODO: Wait for callback
  change_currency_type_ui(currencyType);
}
function change_currency_type_ui(currencyType) {
  $("select#currency_type").val(currencyType);
  BitSplit.currency.setType(currencyType);
}

function refresh_config(config_data) {
    if(typeof config_data.split_n_minutes !== "undefined") {
        $(".split-time-minutes").html(config_data.split_n_minutes);
    }
}
function update_personal_stats(personal_stats) {
  personalStats = personal_stats;

  var currencyType = personalStats.currencyType;
  var balance  = 0;
  var password = "";
  var name     = "";

  change_currency_type_ui(currencyType);

  if(personalStats.name !== null) {
    balance  = personalStats.balance;
    password = personalStats.password;
    name     = personalStats.name;
  }
  $(".my_balance").html(to_btc_str(balance));
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
  },
  login: function(user_name, password) {
    socket.emit("user:login", {user_name: user_name, password: password});
  }
};

var temp = {
  login: function() {
    var user_name = window.prompt("User name?", "");
    var password  = window.prompt("Password?", "");

    user.login(user_name, password);
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
  $('#bitsplitgames').royalSlider({
     controlNavigation : 'bullets'
   });

  // Fade overlay which hides the jumble before royalSlider is activated.
  $(".overlay-solid").fadeOut(3500);

  CHART.init("div.betchart");
});

$("#deposit").on("click", function(e) {
  e.preventDefault();
  BitSplit.UI.currency.deposit();
});
$("#withdraw").on("click", function(e) {
  e.preventDefault();
  BitSplit.UI.currency.withdraw();
});

$("#bet_buttons").on("click", ".btn", function() {
  if(typeof currentStats === null) return false;

  var percentage = $(this).attr("percentage");
  var sel        = ".btccost .btn[percentage='"+percentage+"']";

  var amt = $(sel).html();

  if(percentage === "custom") {
    amt = $("#custom_bet_input").val();
  }

  // Test if is number
  BitSplit.currency.bet(amt, function(err, res) {
    bootstrap_alert.success("Placing bet: "+amt, 1000);
  });
});


var sel = "a.btn.btn-currency";
$(sel).click(function(e) {
  $(sel).removeClass("active");
  $(this).addClass("active");
});



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
