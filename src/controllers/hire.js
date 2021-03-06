/* @Author: Raphael Nepomuceno <raphael.nepomuceno@ufv.br> */

import _ from 'lodash'
import moment from 'moment'

import * as Router from '../utils/router.js'
import * as Middlewares from '../utils/middlewares.js'
import * as Utils from '../utils/utils.js'

import { $Address, $Service, $ServiceCategory, $User, $Contract, sequelize } from '../sequelize.js'

@Router.Route('/hire', [
	Middlewares.restrictedPage({ message: 'Área restrita a usuários cadastrados.' })
])
export class Hire
{
	static findServiceById (id)
	{
		return $Service.findOne({
			raw: true,
			where: { id },
			include: [ $ServiceCategory, $User ]
		})
	}

	static findAddressById (id)
	{
		return $Address.findAll({ where: { userId: id } })
	}

	static die (error, message)
	{
		return (response) => response.render('error.pug', { error, message })
	}

	static render (service, addresses, error)
	{
		return (response) => response.render('hire/index.pug', {
			service,
			error,
			addresses,
			mapPricingType: Utils.mapPricingType
		})
	}

	@Router.Get('/:id')
	static async index ({ params, session }, response)
	{
		const service = await Hire.findServiceById(params.id)
		const address = await Hire.findAddressById(session.user.id)

		if (! service)
			return Hire.die('Serviço inexistente', 'O serviço solicitado não existe.')(response)

		if (service.userId === session.user.id)
			return Hire.die('Erro', 'Não é permitido contratar seu próprio serviço.')(response)

		return Hire.render(service, address)(response)
	}

	@Router.Post('/submit')
	static async contract({ params, body, session }, response)
	{
		const die = Hire.die('Serviço inexistente', 'O serviço solicitado não existe.')

		if(! body.__serviceId)
			return die(response)

		const service = await Hire.findServiceById(body.__serviceId)

		if (! service)
			return die(response)

		if (service.userId === session.user.id)
			return Hire.die('Erro', 'Não é permitido contratar seu próprio serviço.')(response)

		if(service['serviceCategory.pricingType'] === 'Once')
			body.expectedDuration = 1

		if (! body.date || ! body.time || ! body.expectedDuration)
			return Hire.render(service, [ 'Preencha todos os campos' ])(response)

		const startDate = moment(`${body.date} ${body.time}`, 'YYYY-MM-DD hh:mm')

		if(! startDate)
			return Hire.render(service, [ 'Data inválida' ])(response)

		try {
			const contract = await $Contract.create({
				serviceId: service.id,
				userId: session.user.id,
				addressId: body.addressId,
				totalPrice: service.basePrice * body.expectedDuration,
				expectedDuration: body.expectedDuration,
				message: body.message,
				startDate,
				peding: true,
				completed: false,
				accepted: false
			})

			return response.status(200).json(contract)
		} catch (e) {
			return response.render('error.pug', {
				error: 'Erro crítico',
				message: 'Erro desconhecido ao contratar serviço.',
				stack: e.stack
			})
		}
	}
}
