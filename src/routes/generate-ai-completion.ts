import { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";
import { z } from 'zod'
import { streamToResponse, OpenAIStream } from 'ai'
import { createReadStream } from "node:fs";
import { openai } from "../lib/opneai";

export async function generateAiCompletionRoute(app: FastifyInstance) {
  app.post('/ai/complete', async(request, replay) => {
    const bodySchema = z.object({
      videoId: z.string().uuid(),
      prompt: z.string(),
      temperature: z.number().min(0).max(1).default(0.5),
    })

    const { temperature, prompt: template, videoId } = bodySchema.parse(request.body)

    const video = await prisma.video.findUniqueOrThrow({
      where: {
        id: videoId
      }
    })

    if(!video.transcription){
      return replay.status(400).send({ error: "Video transcription was not generated yet."})
    }

    const promptMessage = template.replace('{transcription}', video.transcription)

    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      temperature,
      messages: [
        { role: 'user', content: promptMessage}
      ],
      stream: true,
    })

    const stream = OpenAIStream(response)

    streamToResponse(stream, replay.raw, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS'
      }
    })
  })
}