import { PrismaClient } from '@prisma/client'
import { Router } from 'express'
import { z } from 'zod'
import nodemailer from 'nodemailer'

const prisma = new PrismaClient()

const router = Router()

const votoSchema = z.object({
  clienteId: z.number(),
  candidataId: z.number(),
  justificativa: z.string().optional()
})

const transporter = nodemailer.createTransport({
  host: "sandbox.smtp.mailtrap.io",
  port: 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: "",
    pass: "",
  },
});

async function enviaEmail(email: string, cliente: string, candidata: string) {
  let mensagem = '<h2>Concurso Rainha da Fenadoce 2025</h2>'
  mensagem += `<h3>Estimado cliente ${cliente}</h3>`
  mensagem += `<h3>Obrigado por votar na candidata ${candidata}</h3>`

  const info = await transporter.sendMail({
    from: 'Concurso Rainha da Fenadoce <rainha@gmail.email>',
    to: email,
    subject: "Voto no Concurso",
    text: "Obrigado por votar...", // plain‑text body
    html: mensagem, // HTML body
  });

  console.log("Message sent:", info.messageId);
  
}

router.get("/", async (req, res) => {
  try {
    const votos = await prisma.voto.findMany({
      include: {
        cliente: true,
        candidata: true
      }
    })
    res.status(200).json(votos)
  } catch (error) {
    res.status(500).json({ erro: error })
  }
})

router.post("/", async (req, res) => {

  const valida = votoSchema.safeParse(req.body)
  if (!valida.success) {
    res.status(400).json({ erro: valida.error })
    return
  }

  const { clienteId, candidataId, justificativa } = valida.data

  //pesquisa para obter registro do cliente (recebe-se apenas id)
  const dadoCliente = await prisma.cliente.findUnique({
    where: { id: clienteId}
  })

 //pesquisa para obter registro da candidata(recebe-se apenas id)
  const dadoCandidata = await prisma.candidata.findUnique({
    where: { id: candidataId}
  })

  //chama metodo de envio de email
  enviaEmail(dadoCliente?.email as string, dadoCliente?.nome as string, dadoCandidata?.nome as string)

  try {
    const [voto, candidata] = await prisma.$transaction([
      prisma.voto.create({ 
        data: { clienteId, candidataId, justificativa } 
      }),
      prisma.candidata.update({
        where: { id: candidataId },
        data: { numVotos: { increment: 1 } }
      })])
    res.status(201).json({ voto, candidata })
  } catch (error) {
    res.status(400).json({ error })
  }
})

router.delete("/:id", async (req, res) => {
  const { id } = req.params

  try {

    const votoExcluido = await prisma.voto.findUnique({ where: { id: Number(id) } })

    const [voto, candidata] = await prisma.$transaction([
      prisma.voto.delete({ where: { id: Number(id) } }),
      prisma.candidata.update({
        where: { id: votoExcluido?.candidataId },
        data: { numVotos: { decrement: 1 } }
      })])

    res.status(200).json({ voto, candidata })
  } catch (error) {
    res.status(400).json({ erro: error })
  }
})

export default router
