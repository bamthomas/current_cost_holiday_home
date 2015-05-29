# coding=utf-8
import asyncio
from datetime import datetime
from json import loads, dumps

from aiohttp import web
import aiohttp_jinja2
import asyncio_redis
import jinja2

from daq.current_cost_sensor import CURRENT_COST_KEY
from iso8601_json import with_iso8601_date, Iso8601DateEncoder
from subscribers.redis_toolbox import RedisTimeCappedSubscriber

now = datetime.now


@asyncio.coroutine
def create_redis_connection():
    connection = yield from asyncio_redis.Connection.create(host='localhost', port=6379)
    return connection


@asyncio.coroutine
def message_stream():
    redis_conn = yield from create_redis_connection()
    subscriber = yield from redis_conn.start_subscribe()
    yield from subscriber.subscribe([CURRENT_COST_KEY])
    while True:
        reply = yield from subscriber.next_published()
        return reply.value


@asyncio.coroutine
def stream(request):
    ws = web.WebSocketResponse()
    ws.start(request)
    while True:
        data = yield from message_stream()
        ws.send_str(data)
    return ws


@aiohttp_jinja2.template('index.html')
def home(_):
    return {}


@asyncio.coroutine
def menu_item(request):
    page = request.match_info['page']
    return aiohttp_jinja2.render_template('%s.html' % page, request, {})


@asyncio.coroutine
def today(request):
    return web.Response(body=dumps({'points': (yield from get_current_cost_data(request.app['redis_connection']))},
                                   cls=Iso8601DateEncoder).encode())


@asyncio.coroutine
def livedata(request):
    seconds = request.match_info['seconds']
    return {'points': request.app['live_data_service'].get_data(since_seconds=seconds)}


@asyncio.coroutine
def get_current_cost_data(redis_conn):
    list_reply = yield from redis_conn.lrange('current_cost_%s' % datetime.now().strftime('%Y-%m-%d'), 0, -1)
    l = yield from list_reply.aslist()
    return list(map(lambda json: loads(json, object_hook=with_iso8601_date), l))


@asyncio.coroutine
def init(aio_loop):
    app = web.Application(loop=aio_loop)
    app['redis_connection'] = yield from create_redis_connection()

    app.router.add_static(prefix='/static', path='static')
    aiohttp_jinja2.setup(app, loader=jinja2.FileSystemLoader('templates'))

    app.router.add_route('GET', '/stream', stream)
    app.router.add_route('GET', '/', home)
    app.router.add_route('GET', '/today', today)
    app.router.add_route('GET', '/data_since/{seconds}', livedata)
    app.router.add_route('GET', '/menu/{page}', menu_item)

    redis_conn = yield from create_redis_connection()

    app['live_data_service'] = RedisTimeCappedSubscriber(redis_conn, 'current_cost_live_data', 3600,
                                                         pubsub_key=CURRENT_COST_KEY, indicator_key='watt').start()

    srv = yield from aio_loop.create_server(app.make_handler(), '127.0.0.1', 8080)
    print("Server started at http://127.0.0.1:8080")
    return srv


if __name__ == '__main__':
    loop = asyncio.get_event_loop()
    loop.run_until_complete(init(loop))
    loop.run_forever()
