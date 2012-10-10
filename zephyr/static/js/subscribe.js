function fetch_subs() {
    $.ajax({
        type:     'GET',
        url:      'json/subscriptions/list',
        dataType: 'json',
        timeout:  10*1000,
        success: function (data) {
            $('#subscriptions_table tr').remove();
            if (data) {
                $.each(data.subscriptions, function (index, name) {
                    $('#subscriptions_table').append(templates.subscription({subscription: name}));
                });
            }
            $('#new_subscription').focus().select();
        },
        error: function (xhr) {
            report_error("Error listing subscriptions", xhr, $("#subscriptions-status"));
        }
    });
}

function sub_from_home(stream, prompt_button) {
    $.ajax({
        type:     'POST',
        url:      '/json/subscriptions/add',
        data:      {new_subscription: stream},
        dataType: 'json',
        timeout:  10*60*1000, // 10 minutes in ms
        success: function (response) {
            add_to_stream_list(response.data);
            $("#compose form").ajaxSubmit();
            prompt_button.stop(true).fadeOut(500);
        },
        error: function (xhr, error_type, exn) {
            report_error("Unable to subscribe", xhr, $("#home-error"));
        }
    });
}

stream_list_hash = [];

function subscribed_to(stream_name) {
    return (stream_list_hash[stream_name.toLowerCase()] === true);
}

function case_insensitive_subscription_index(stream_name) {
    var i;
    var name = stream_name.toLowerCase();

    for (i = 1; i < stream_list.length; i++) {
        if (name === stream_list[i].toLowerCase()) {
            return i;
        }
    }
    return -1;
}

function add_to_stream_list(stream_name) {
    if (!subscribed_to(stream_name)) {
        stream_list.push(stream_name);
        stream_list_hash[stream_name.toLowerCase()] = true;
    }
}

function remove_from_stream_list(stream_name) {
    delete stream_list_hash[stream_name.toLowerCase()];
    var removal_index = case_insensitive_subscription_index(stream_name);
    if (removal_index !== -1) {
        stream_list.splice(removal_index, 1);
    }
}

// FIXME: It would be nice to move the UI setup into ui.js.
$(function () {
    $("#current_subscriptions").ajaxForm({
        dataType: 'json', // This seems to be ignored. We still get back an xhr.
        success: function (resp, statusText, xhr, form) {
            var name = $.parseJSON(xhr.responseText).data;
            $('#subscriptions_table').find('button[value="' + name + '"]').parents('tr').remove();
            remove_from_stream_list(name);
            update_autocomplete();
            report_success("Successfully removed subscription to " + name,
                           $("#subscriptions-status"));
        },
        error: function (xhr) {
            report_error("Error removing subscription", xhr, $("#subscriptions-status"));
        }
    });

    $("#add_new_subscription").ajaxForm({
        dataType: 'json', // This seems to be ignored. We still get back an xhr.
        success: function (resp, statusText, xhr, form) {
            $("#new_subscription").val("");
            var name = $.parseJSON(xhr.responseText).data;
            $('#subscriptions_table').prepend(templates.subscription({subscription: name}));
            add_to_stream_list(name);
            report_success("Successfully added subscription to " + name,
                           $("#subscriptions-status"));
            $("#new_subscription").focus();
        },
        error: function (xhr) {
            report_error("Error adding subscription", xhr, $("#subscriptions-status"));
            $("#new_subscription").focus();
        }
    });
});
