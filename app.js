require('module-alias/register')

const Koa = require('koa')
const parser = require('koa-bodyparser')
const InitManager = require('./core/init')
const catchError = require('./middleware/exception')
const cors = require('koa2-cors');
const multipart = require('./core/multipart')

const app = new Koa()

app.use(cors({
    origin: function (ctx) {
        return ctx.header.origin
      }
  }))
app.use(catchError)
app.use(parser())
multipart(app)

InitManager.initCore(app)

const port = Number(process.env.PORT) || 3000

app.listen(port, () => {
  console.log(`当前 NODE_ENV ${process.env.NODE_ENV}. listening port ${port}`)
})