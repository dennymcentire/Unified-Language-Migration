var active = "active";


$(document).ready(function() {
    $("body").click(function() {
        $(".modal").addClass(active);
        $(".scrim").addClass(active);
    });

    $(".modal-close-button").click(function(event) {
        $(".modal").removeClass(active);
        $(".scrim").removeClass(active);
        event.stopPropagation();
    })


});
