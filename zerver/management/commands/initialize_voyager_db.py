from argparse import ArgumentParser
from typing import Any

from django.conf import settings
from django.core.management.base import BaseCommand

from zerver.lib.actions import do_change_is_admin
from zerver.lib.server_initialization import create_users
from zerver.models import Realm, UserProfile, \
    get_client, get_system_bot

settings.TORNADO_SERVER = None

class Command(BaseCommand):
    help = "Populate an initial database for Zulip Voyager"

    def add_arguments(self, parser: ArgumentParser) -> None:
        parser.add_argument('--extra-users',
                            dest='extra_users',
                            type=int,
                            default=0,
                            help='The number of extra users to create')

    def handle(self, *args: Any, **options: Any) -> None:
        if Realm.objects.count() > 0:
            print("Database already initialized; doing nothing.")
            return
        realm = Realm.objects.create(string_id=settings.SYSTEM_BOT_REALM)

        # Create the "website" and "API" clients:
        get_client("website")
        get_client("API")

        internal_bots = [(bot['name'], bot['email_template'] % (settings.INTERNAL_BOT_DOMAIN,))
                         for bot in settings.INTERNAL_BOTS]
        create_users(realm, internal_bots, bot_type=UserProfile.DEFAULT_BOT)
        # Set the owners for these bots to the bots themselves
        bots = UserProfile.objects.filter(email__in=[bot_info[1] for bot_info in internal_bots])
        for bot in bots:
            bot.bot_owner = bot
            bot.save()

        # Initialize the email gateway bot as an API Super User
        email_gateway_bot = get_system_bot(settings.EMAIL_GATEWAY_BOT)
        do_change_is_admin(email_gateway_bot, True, permission="api_super_user")

        self.stdout.write("Successfully populated database with initial data.\n")
        self.stdout.write("Please run ./manage.py generate_realm_creation_link "
                          "to generate link for creating organization")