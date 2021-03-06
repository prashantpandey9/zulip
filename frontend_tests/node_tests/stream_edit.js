"use strict";

const {strict: assert} = require("assert");

const {stub_templates} = require("../zjsunit/handlebars");
const {rewiremock, set_global, zrequire} = require("../zjsunit/namespace");
const {run_test} = require("../zjsunit/test");
const $ = require("../zjsunit/zjquery");

const noop = () => {};
stub_templates(() => noop);

rewiremock("../../static/js/hashchange").with({update_browser_history: noop});
rewiremock("../../static/js/hash_util").with({
    stream_edit_uri: noop,
    by_stream_uri: noop,
});
rewiremock("../../static/js/list_widget").with({
    create: () => ({init: noop}),
});
const page_params = set_global("page_params", {});
rewiremock("../../static/js/settings_notifications").with({
    get_notifications_table_row_data: noop,
});
rewiremock("../../static/js/stream_color").with({
    set_colorpicker_color: noop,
});
const typeahead_helper = {__esModule: true};
rewiremock("../../static/js/typeahead_helper").with(typeahead_helper);
const ui = {
    __esModule: true,
    get_scroll_element: noop,
};

rewiremock("../../static/js/ui").with(ui);

const peer_data = zrequire("peer_data");
const people = zrequire("people");
const stream_edit = zrequire("stream_edit");
const stream_data = zrequire("stream_data");
const stream_pill = zrequire("stream_pill");
const user_pill = zrequire("user_pill");

stream_edit.__Rewire__("sort_but_pin_current_user_on_top", noop);

const jill = {
    email: "jill@zulip.com",
    user_id: 10,
    full_name: "Jill Hill",
};
const mark = {
    email: "mark@zulip.com",
    user_id: 20,
    full_name: "Marky Mark",
};
const fred = {
    email: "fred@zulip.com",
    user_id: 30,
    full_name: "Fred Flintstone",
};
const me = {
    email: "me@example.com",
    user_id: 40,
    full_name: "me",
};

page_params.user_id = me.user_id;
const persons = [jill, mark, fred, me];
for (const person of persons) {
    people.add_active_user(person);
}

const denmark = {
    stream_id: 1,
    name: "Denmark",
    subscribed: true,
    render_subscribers: true,
    should_display_subscription_button: true,
};
peer_data.set_subscribers(denmark.stream_id, [me.user_id, mark.user_id]);

const sweden = {
    stream_id: 2,
    name: "Sweden",
    subscribed: false,
};
peer_data.set_subscribers(sweden.stream_id, [mark.user_id, jill.user_id]);

const subs = [denmark, sweden];
for (const sub of subs) {
    stream_data.add_sub(sub);
}

function test_ui(label, f) {
    run_test(label, (override) => {
        stream_edit.initialize();
        f(override);
    });
}

test_ui("subscriber_pills", () => {
    const subscriptions_table_selector = "#subscriptions_table";
    const input_field_stub = $.create(".input");

    input_field_stub.before = () => {};

    const sub_settings_selector = `#subscription_overlay .subscription_settings[data-stream-id='${CSS.escape(
        denmark.stream_id,
    )}']`;
    const $sub_settings_container = $.create(sub_settings_selector);
    $sub_settings_container.find = noop;
    $sub_settings_container.find = () => input_field_stub;

    const pill_container_stub = $.create(sub_settings_selector + " .pill-container");
    pill_container_stub.find = () => input_field_stub;

    const $subscription_settings = $.create(".subscription_settings");
    $subscription_settings.addClass = noop;
    $subscription_settings.closest = () => $subscription_settings;
    $subscription_settings.attr("data-stream-id", denmark.stream_id);
    $subscription_settings.length = 0;

    const $add_subscribers_form = $.create(".subscriber_list_add form");
    $add_subscribers_form.closest = () => $subscription_settings;

    let template_rendered = false;
    ui.get_content_element = () => {
        template_rendered = true;
        return {html: noop};
    };

    let expected_user_ids = [];
    let input_typeahead_called = false;
    let add_subscribers_request = false;
    stream_edit.__Rewire__("invite_user_to_stream", (user_ids, sub) => {
        assert.equal(sub.stream_id, denmark.stream_id);
        assert.deepEqual(user_ids.sort(), expected_user_ids.sort());
        add_subscribers_request = true;
    });

    input_field_stub.typeahead = (config) => {
        assert.equal(config.items, 5);
        assert(config.fixed);
        assert(config.dropup);
        assert(config.stopAdvance);

        assert.equal(typeof config.source, "function");
        assert.equal(typeof config.highlighter, "function");
        assert.equal(typeof config.matcher, "function");
        assert.equal(typeof config.sorter, "function");
        assert.equal(typeof config.updater, "function");

        const fake_this = {
            query: "#Denmark",
        };

        (function test_highlighter() {
            const fake_stream = $.create("fake-stream");
            typeahead_helper.render_stream = () => fake_stream;
            assert.equal(config.highlighter.call(fake_this, denmark), fake_stream);
        })();

        (function test_matcher() {
            let result = config.matcher.call(fake_this, denmark);
            assert(result);

            result = config.matcher.call(fake_this, sweden);
            assert(!result);
        })();

        (function test_sorter() {
            let sort_streams_called = false;
            typeahead_helper.sort_streams = () => {
                sort_streams_called = true;
            };
            config.sorter.call(fake_this);
            assert(sort_streams_called);
        })();

        (function test_updater() {
            function number_of_pills() {
                const pills = stream_edit.pill_widget.items();
                return pills.length;
            }

            assert.equal(number_of_pills(), 0);
            config.updater.call(fake_this, denmark);
            assert.equal(number_of_pills(), 1);
            fake_this.query = me.email;
            config.updater.call(fake_this, me);
            assert.equal(number_of_pills(), 2);
            fake_this.query = "#Denmark";
        })();

        (function test_source() {
            const result = config.source.call(fake_this);
            const taken_ids = stream_pill.get_stream_ids(stream_edit.pill_widget);
            const stream_ids = Array.from(result, (stream) => stream.stream_id).sort();
            let expected_ids = Array.from(subs, (stream) => stream.stream_id).sort();
            expected_ids = expected_ids.filter((id) => !taken_ids.includes(id));
            assert.deepEqual(stream_ids, expected_ids);
        })();

        input_typeahead_called = true;
    };

    // Initialize pill widget upon displaying subscription settings page.
    const stream_row_handler = $(subscriptions_table_selector).get_on_handler(
        "click",
        ".stream-row",
    );

    let fake_this = $subscription_settings;
    let event = {target: fake_this};
    stream_row_handler.call(fake_this, event);
    assert(template_rendered);
    assert(input_typeahead_called);

    let add_subscribers_handler = $(subscriptions_table_selector).get_on_handler(
        "submit",
        ".subscriber_list_add form",
    );

    fake_this = $add_subscribers_form;
    fake_this.closest = () => $subscription_settings;
    event = {
        target: fake_this,
        preventDefault: () => {},
    };

    // We cannot subscribe ourselves (`me`) as
    // we are already subscribed to denmark stream.
    const potential_denmark_stream_subscribers = Array.from(
        peer_data.get_subscribers(denmark.stream_id),
    ).filter((id) => id !== me.user_id);

    // denmark.stream_id is stubbed. Thus request is
    // sent to add all subscribers of stream Denmark.
    expected_user_ids = potential_denmark_stream_subscribers;
    add_subscribers_handler(event);

    add_subscribers_handler = $(subscriptions_table_selector).get_on_handler(
        "keyup",
        ".subscriber_list_add form",
    );
    event.which = 13;

    // Only Denmark stream pill is created and a
    // request is sent to add all it's subscribers.
    user_pill.__Rewire__("get_user_ids", () => []);
    expected_user_ids = potential_denmark_stream_subscribers;
    add_subscribers_handler(event);

    // No request is sent when there are no users to subscribe.
    stream_pill.get_user_ids = () => [];
    add_subscribers_request = false;
    add_subscribers_handler(event);
    assert(!add_subscribers_request);

    // No request is sent if we try to subscribe ourselves
    // only and are already subscribed to the stream.
    user_pill.__Rewire__("get_user_ids", () => [me.user_id]);
    add_subscribers_handler(event);
    assert(!add_subscribers_request);

    // Denmark stream pill and fred and mark user pills are created.
    // But only one request for mark is sent even though a mark user
    // pill is created and mark is also a subscriber of Denmark stream.
    user_pill.__Rewire__("get_user_ids", () => [mark.user_id, fred.user_id]);
    stream_pill.get_user_ids = () => peer_data.get_subscribers(denmark.stream_id);
    expected_user_ids = potential_denmark_stream_subscribers.concat(fred.user_id);
    add_subscribers_handler(event);
});
