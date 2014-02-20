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

    window.next_split_ms = current_stats.next_split_ms;

    var current_winning_contribution = 0;
    if(current_stats.contributors[0]) {
        current_winning_contribution = current_stats.contributors[0].contribution;
    }
    $("#current-winning-contribution").html("<i class='fa fa-btc'></i>"+to_btc(current_winning_contribution));
    $("#jackpot-amount").html("<i class='fa fa-btc'></i>"+to_btc(current_stats.jackpot));
    $("#prize-amount").html("<i class='fa fa-btc'></i>"+to_btc(current_stats.prize));

    for(var ii = 0; ii < current_stats.contributors.length && ii < 10; ii++)
    {
        var font_color = "bitcoin-symbol font-color-bitcoin";

        var contributor          = current_stats.contributors[ii];
        var percent_contribution = contributor.percent.total_contribution * 100;
        var percent_win_chance   = contributor.percent.win_chance * 100;

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

        var str  = "<tr>";
        str     += "<td>"+current_stats.contributors[ii].user_id+"</td>";
        str     += "<td class='"+font_color+" font-weight-heavy'>"+to_btc(current_stats.contributors[ii].contribution)+"</td>";
        str     += "<td class='percentage-symbol "+font_odds+"'>"+percent_win_chance.toPrecision(3)+"</td>";
        str     += "<td>"+odds_symbol+"</td>";
        str     += "<td class='percentage-symbol "+font_odds+"'>"+percent_contribution.toPrecision(3)+"</td>";
        str     += "</tr>";

        $(table_id).append(str);
    }
}

function refresh_past_winners(past_winners)
{
    var table_id = "#past_winners table tbody";
    $(table_id).html("");

    for(var ii = 0; ii < past_winners.length && ii < 10; ii++)
    {
        var player      = past_winners[ii];

        var win_or_lose = "win";
        if(player.payout === player.contribution) {
            win_or_lose = "neutral";
        } else if(player.contribution > player.payout) {
            win_or_lose = "lose";
        }

        var str  = "<tr>";
        str     += "<td>"+past_winners[ii].user_id+"</td>";
        str     += "<td class='bitcoin-symbol font-color-bitcoin-neutral'>"+to_btc(player.contribution)+"</td>";
        str     += "<td class='bitcoin-symbol font-color-bitcoin-"+win_or_lose+"'>"+to_btc(player.payout)+"</td>";
        str     += "</tr>";

        $(table_id).append(str);
    }
}

function place_bet(satoshis) {
  $.post("/bet_current_jackpot", {amount: satoshis}, function(res) {

  });
}

function refresh_config(config_data) {
    console.log(config_data);
    if(typeof config_data.split_n_minutes !== "undefined") {
        $(".split-time-minutes").html(config_data.split_n_minutes);
    }
}

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
