# coding=utf-8
import asyncio
from json import dumps


import asyncio_redis


#duplicate from redis_toolbox
def create_redis_pool(size):
    pool = yield from asyncio_redis.Pool.create(host='localhost', port=6379, poolsize=size)
    return pool

@asyncio.coroutine
def create_redis_connection():
    connection = yield from asyncio_redis.Connection.create(host='localhost', port=6379)
    return connection


class RedisPublisher(object):

    def __init__(self, redis_conn, key):
        self.key = key
        self.redis_conn = redis_conn

    @asyncio.coroutine
    def publish(self, event):
        yield from self.redis_conn.publish(self.key, dumps(event))
