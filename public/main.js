bootstrap_alert = {};
bootstrap_alert.warning = function(message, fadeout_ms) {
  if(typeof fadeout_ms !== "number") {
    fadeout_ms = 4000;
  }

  $('#alert').html('<div class="alert alert-danger alert-dismissable"><button type="button" class="close" data-dismiss="alert" aria-hidden="true">&times;</button><span>'+message+'</span></div>')
  .delay(200).fadeIn().delay(fadeout_ms).fadeOut();
};

$(document).ready(function() {
    // Split logo animation
    $(".navbar-brand").on("mouseover", function() {
        $("#logo_split").html("&nbsp;");
        $("#logo_split2").html("");
      });
    $(".navbar-brand").on("mouseout", function() {
        $("#logo_split").html("");
        $("#logo_split2").html("&nbsp;");
      });

   // Refreshes our countdown timer
   setInterval(function() {
       if(typeof window.next_split_ms !== "number") {
         return false;
       }
       var next_split_ms = window.next_split_ms;
       var seconds_left  =
           Math.floor((next_split_ms - new Date().getTime())/1000);

       // TODO: This should check for < 0, not the pretty-time formatter
       var pretty_time = seconds_to_pretty_time(seconds_left);
       $('.split-countdown-timer').html(pretty_time);
   }, 500);
});

function refresh_current_stats(current_stats)
{
    var table_id = "#current_contenders table tbody";
    $(table_id).html("");

    var trts = current_stats.time_remaining_to_split;
    var latency = 250; // Assumption
    window.next_split_ms = new Date().getTime()+trts-latency;

    var current_winning_contribution = 0;
    if(current_stats.contributors[0]) {
        current_winning_contribution = current_stats.contributors[0].contribution;
    }
    $("#current-winning-contribution").html("<i class='fa fa-btc'></i>"+to_btc(current_winning_contribution));
    $("#jackpot-amount").html("<i class='fa fa-btc'></i>"+to_btc(current_stats.jackpot));
    $("#prize-amount").html("<i class='fa fa-btc'></i>"+to_btc(current_stats.prize));

    var current_user = $("#user").html();
    current_player_percent_win_chance = 0;
    current_player_contribution       = 0;

    for(var ii = 0; ii < current_stats.contributors.length && ii < 10; ii++)
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
        contribution         = contribution.toPrecision(3);
        percent_contribution = percent_contribution.toPrecision(3);

        if(current_user === user.name) {
            current_player_percent_win_chance = percent_win_chance;
            current_player_contribution       = contribution;
        }

        var str  = "<tr>";
        str     += "<td>"+user.name+"</td>";
        str     += "<td class='"+font_color+" font-weight-heavy'>"+contribution+"</td>";
        str     += "<td class='percentage-symbol "+font_odds+"'>"+percent_win_chance+"</td>";
        str     += "<td>"+odds_symbol+"</td>";
        str     += "<td class='percentage-symbol "+font_odds+"'>"+percent_contribution+"</td>";
        str     += "</tr>";

        $(table_id).append(str);
    }
    $("#player_chance_of_winning").html(current_player_percent_win_chance);
    $("#player_contribution").html(current_player_contribution);
}

function refresh_past_winners(past_winners)
{
    var table_id = "#past_winners table tbody";
    $(table_id).html("");

    for(var ii = 0; ii < past_winners.length && ii < 10; ii++)
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
        str     += "<td class='bitcoin-symbol font-color-bitcoin-neutral'>"+to_btc(dsbs.total)+"</td>"; // Size
        str     += "<td>"+user.name+"</td>"; // Winner name
        str     += "<td class='bitcoin-symbol font-color-bitcoin-neutral'>"+to_btc(jackpot.contribution)+"</td>"; // Winner contribution

        // Disbursements
        str     += "<td class='bitcoin-symbol font-color-bitcoin-"+win_or_lose+"'>"+to_btc(dsbs.winner)+"</td>";
        str     += "<td class='bitcoin-symbol font-color-bitcoin-neutral'>"+to_btc(dsbs.next_jackpot)+"</td>"; // Next Jackpot
        str     += "<td class='bitcoin-symbol font-color-bitcoin-neutral'>"+to_btc(dsbs.house)+"</td>"; // House
        str     += "</tr>";

        $(table_id).append(str);
    }
}

function place_bet(satoshis) {
  socket.emit("bet:current_jackpot", satoshis);
}

function refresh_config(config_data) {
    console.log(config_data);
    if(typeof config_data.split_n_minutes !== "undefined") {
        $(".split-time-minutes").html(config_data.split_n_minutes);
    }
}

function update_personal_stats(personal_stats) {
    $("#user_balance").html(to_btc(personal_stats.balance));
}

var user = {
  create: function(user_name) {
    socket.emit("user:create", user_name);
  },
  add_to_balance: function(satoshis) {
    socket.emit("user:add_to_balance", satoshis);
  }
};

$("#deposit").on("click", function(e) {
  e.preventDefault();
  var amt = window.prompt("How many satoshis will you add to your balance?", 0);
  user.add_to_balance(amt);
});

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

function to_btc(satoshis) {
    return satoshis/Math.pow(10,8);
}
function to_satoshis(btc) {
    return btc*Math.pow(10,8);
}
