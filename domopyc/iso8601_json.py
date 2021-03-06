from datetime import datetime
from decimal import Decimal
import json
import iso8601


class Iso8601DateEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, datetime):
            return obj.isoformat()
        if isinstance(obj, Decimal):
            return float(obj)
        return json.JSONEncoder.default(self, obj)


def with_iso8601_date(dct):
    if 'date' in dct:
        return dict(dct, date=iso8601.parse_date(dct['date']))
    return dct