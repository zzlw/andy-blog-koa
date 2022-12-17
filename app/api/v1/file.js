const Router = require('koa-router')

const { UpLoader } = require('../../lib/upload')
const { Auth } = require('../../../middleware/auth')

const fileApi = new Router({
  prefix: '/v1/file'
})

fileApi.post('/', new Auth().m, async (ctx) => {
  const files = await ctx.multipart()

  const upLoader = new UpLoader(`blog/`)
  const arr = await upLoader.upload(files)
  ctx.body = arr
})

fileApi.post('/music', new Auth().m, async (ctx) => {
  const files = await ctx.multipart({
    singleLimit: 1024 * 1024 * 10
  })

  const upLoader = new UpLoader(`music/`)
  const arr = await upLoader.upload(files)
  ctx.body = arr
})

module.exports = fileApi