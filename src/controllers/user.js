/*! @Author: Raphael Nepomuceno <raphael.nepomuceno@ufv.br> */

import _ from 'lodash'

import * as Router from '../utils/router.js'
import { $Address, $User, sequelize } from '../sequelize.js'

const redirectIfAuthenticated = (request, response, next) =>
{
	return request.session.user ? response.redirect('/') : next()
}

@Router.Route({ route: '/user' })
export class User
{
	@Router.Get('/')
	static async all (request, response)
	{
		return response.status(200).json({
			payload: await $User.findAll()
		})
	}

	@Router.Get('/weightedRank')
	static async weightedRating ({ params }, response)
	{
		const sql = `SELECT
			receiverId,
			(SUM((reviews.rating - 3) / 2) + 10 / (SELECT COUNT(*) + 20 FROM reviews GROUP BY receiverId)) AS weightedRating
			FROM reviews
			GROUP BY receiverId`

		try {
			const rank = await sequelize.query(sql, {
				type: sequelize.QueryTypes.SELECT,
				replacements: { id: params.id }
			})

			return response.json(rank)
		} catch (e) {
			return response.status(400).render('error.pug', {
				status: '0x05',
				error: 'Erro ao computar relatório',
				message: 'Erro desconhecido.',
				stack: e.stack
			})
		}
	}

	@Router.Get('/:id/report/services')
	static async serviceReport ({ params }, response)
	{
		const sql = `SELECT users.fullname,
			serviceCategories.name AS category,
			services.title AS title,
			SUM(contracts.totalPrice) AS sum,
			COUNT(*) AS count,
			AVG(contracts.totalPrice) AS avg
			FROM users
			INNER JOIN services ON users.id = services.userId
			INNER JOIN contracts ON contracts.serviceId = services.id
			INNER JOIN serviceCategories ON serviceCategories.id = services.serviceCategoryId
			WHERE users.id = :id
			GROUP BY services.id
			ORDER BY SUM(contracts.totalPrice) DESC`

		try {
			const rank = await sequelize.query(sql, {
				type: sequelize.QueryTypes.SELECT,
				replacements: { id: params.id }
			})

			return response.json(rank)
		} catch (e) {
			return response.status(400).render('error.pug', {
				status: '0x05',
				error: 'Erro ao computar relatório',
				message: 'Erro desconhecido.',
				stack: e.stack
			})
		}
	}

	@Router.Get('/:id/report')
	static async userReport ({ params }, response)
	{
		const sql = `SELECT
				users.fullname AS fullname,
				serviceCategories.name AS category,
				services.title AS title,
				contracts.totalPrice AS price,
				services.basePrice AS baseprice,
				serviceCategories.pricingType AS pricingType
			FROM users
			INNER JOIN contracts ON contracts.userId = users.id
			INNER JOIN services ON contracts.serviceId = services.id
			INNER JOIN serviceCategories ON serviceCategories.id = services.serviceCategoryId
			WHERE users.id = :id
			ORDER BY contracts.totalPrice DESC`

		try {
			const rank = await sequelize.query(sql, {
				type: sequelize.QueryTypes.SELECT,
				replacements: { id: params.id }
			})

			return response.json(rank)
		} catch (e) {
			return response.status(400).render('error.pug', {
				status: '0x05',
				error: 'Erro ao computar relatório',
				message: 'Erro desconhecido.',
				stack: e.stack
			})
		}
	}

	@Router.Get('/logout')
	@Router.Post('/logout')
	static async logout(request, response)
	{
		request.session.destroy()
		return response.redirect('/user/login')
	}

	@Router.Get('/login', [ redirectIfAuthenticated ])
	@Router.Post('/login', [ redirectIfAuthenticated ])
	static async login (request, response)
	{
		const { email, password } = request.body

		if (! email || ! password)
			return response.render('login.pug')

		return await $User.findOne({
			where: { email }
		}).then(user => {
			if (! user)
				return response.render('login.pug', { message: 'Usuário inexistente.' })
			else if (! user.authenticate(password))
				return response.render('login.pug', { message: 'Senha incorreta.' })

			request.session.user = user
			return response.redirect('/')
		})
	}

	@Router.Get('/register', [ redirectIfAuthenticated ])
	@Router.Post('/register', [ redirectIfAuthenticated ])
	static async register ({ body }, response)
	{
		if (_.isEmpty(body))
			return response.status(400).render('register.pug', { error: [ 'Preencha todos os campos.' ] })

		if(body.password !== body.confirmPassword)
			return response.status(400).render('register.pug', { error: [ 'As senhas inseridas não são iguais.' ] })

		try {
			await sequelize.transaction(async (transaction) => {
				const user = await $User.create({ ...body, authLevel: 'Admin', rating: 0 }, { transaction })
				const addr = await $Address.create({ ...body, userId: user.id }, { transaction })

				return user
			})

			return response.render('success.pug',{
				message: 'Cadastro Concluído!'
			})
		} catch (e) {
			const mapPathToErrors =
			{
				email: 'E-mail já cadastrado.',
				CPF: 'CPF já cadastrado.'
			}

			return response.status(400).render('register.pug', {
				error: e.errors.map(p => mapPathToErrors[ p.path ] || p.path)
			})
		}
	}
}
