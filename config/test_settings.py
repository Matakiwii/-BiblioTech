import os

os.environ.setdefault('BIBLIOTECA_DB_PASSWORD', 'test-only-not-used')

from .settings import *  # noqa: F403

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': ':memory:',
    },
}
