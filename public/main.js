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
});

function refresh_current_stats(current_stats)
{
    var table_id = "#current_top_contributors table tbody";
    $(table_id).html("");

    var current_winning_contribution = 0;
    if(current_stats.contributors[0]) {
        current_winning_contribution = current_stats.contributors[0].contribution;
    }
    $("#current-winning-contribution").html("<i class='fa fa-btc'></i>"+to_btc(current_winning_contribution));
    $("#jackpot-amount").html("<i class='fa fa-btc'></i>"+to_btc(current_stats.jackpot));
    $("#prize-amount").html("<i class='fa fa-btc'></i>"+to_btc(current_stats.prize));

    for(var ii = 0; ii < current_stats.contributors.length && ii < 10; ii++)
    {
        var font_color = "font-color-bitcoin font-color-bitcoin-";
        font_color += ii === 0 ? "win" : "lose";

        var str  = "<tr>";
        str     += "<td>"+(ii+1)+"</td>";
        str     += "<td>"+current_stats.contributors[ii].user_id+"</td>";
        str     += "<td class='"+font_color+"'>"+to_btc(current_stats.contributors[ii].contribution)+"</td>";
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
        var str  = "<tr>";
        str     += "<td>"+past_winners[ii].user_id+"</td>";
        str     += "<td class='font-color-bitcoin font-color-bitcoin-neutral'>"+to_btc(past_winners[ii].contribution)+"</td>";
        str     += "<td class='font-color-bitcoin font-color-bitcoin-win'>"+to_btc(past_winners[ii].payout)+"</td>";
        str     += "</tr>";

        $(table_id).append(str);
    }
}

function refresh_current_bets(current_bets) {
     var id = "#current_bets table tbody";
     $(id).html("");

    for(var ii = 0; ii < current_bets.length && ii < 10; ii++)
    {
        var str  = "<tr>";
        str     += "<td>"+current_bets[ii].user_id+"</td>";
        str     += "<td>"+current_bets[ii].user_id+"</td>";
        str     += "<td>Timestamp</td>";
        str     += "<td class='font-color-bitcoin font-color-bitcoin-neutral'>"+to_btc(current_bets[ii].amount)+"</td>";
        str     += "</tr>";

        $(id).append(str);
    }
}

function refresh_config(config_data) {
    console.log(config_data);
    if(typeof config_data.split_n_minutes !== "undefined") {
        $(".split-time-minutes").html(config_data.split_n_minutes);
    }
}

function to_btc(satoshis) {
    return satoshis/Math.pow(10,8);
}
function to_satoshis(btc) {
    return btc*Math.pow(10,8);
}
