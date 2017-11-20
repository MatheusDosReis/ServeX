/**
 * @Author: Raphael Nepomuceno <raphael.nepomuceno@ufv.br>
 * @Date:   2017-11-06
 */

import path from 'path'
import url from 'url'
import express from 'express'

import bodyParser from 'body-parser'

import { SERVER_PORT } from './settings.js'
import { sequelize } from './sequelize.js'

import * as Controllers from './controllers'

const app = express()

// To support JSON-encoded bodies
app.use(
	bodyParser.json()
)

// To support URL-encoded bodies
app.use(
	bodyParser.urlencoded({ extended: true })
)

// Carrega o engine de templates
app.set('view engine', 'pug')
app.set('views', path.join(__dirname, '/views'))

// Roteia os arquivos da front-end.
app.use('/public', express.static('public'))

// Expoẽ a rota local ao pug
app.use((req, res, next) => {
	res.locals.request = { path: req.path }
	res.locals.title = 'ServeX'
	res.locals.respath = (resource) => url.resolve('http://localhost:44800/', resource)
	return next()
})

// Registra as rotas
Controllers.Index.registerRoutes(app)
Controllers.User.registerRoutes(app)
Controllers.Service.registerRoutes(app)

// error handler
app.use(
	(error, req, res, next) => {
		res.status(error.status || 500).render('error.pug', {
			message: error.message, error
		})
	}
)

// Realiza a conexão com o banco de dados. Caso suceda, inicia o servidor HTTP.
// Caso contrário, fecha a aplicação.
sequelize.authenticate().then(() => {
	// Inicia o servidor.
	app.listen(SERVER_PORT, () => console.log('\x1b[34m[%s]\x1b[0m %s', 'servex', '🍻 Servidor iniciado.'))
}).catch(err => {
	console.error('\x1b[31m[%s]\x1b[0m %s', 'server error', err)
	process.exit(1)
})
