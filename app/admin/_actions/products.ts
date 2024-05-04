'use server'

import db from '@/db/db'
import { z } from 'zod'
import fs from 'fs/promises'
import { notFound, redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import {
  v2 as cloudinary,
  UploadApiErrorResponse,
  UploadApiResponse,
} from 'cloudinary'
import {
  deleteFile,
  extractFilenameFromURL,
  FOLDER,
  IMAGES_FOLDER,
  productFilesUpload,
  updateProductFiles,
} from '@/lib/productFiles'
import { error } from 'console'

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

const fileSchema = z.instanceof(File, { message: 'Required' })
const imageSchema = fileSchema.refine(
  file => file.size === 0 || file.type.startsWith('image/'),
)

const addSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  priceInCents: z.coerce.number().int().min(1),
  file: fileSchema.refine(file => file.size > 0, 'Required'),
  image: imageSchema.refine(file => file.size > 0, 'Required'),
})

function isUploadApiResponse(response: any): response is UploadApiResponse {
  return 'url' in response
}

export async function addProduct(prevState: unknown, formData: FormData) {
  const result = addSchema.safeParse(Object.fromEntries(formData.entries()))
  if (result.success === false) {
    return result.error.formErrors.fieldErrors
  }

  const data = result.data

  //save  localy

  // await fs.mkdir('products', { recursive: true })
  // const filePath = `products/${crypto.randomUUID()}-${data.file.name}`
  // await fs.writeFile(filePath, Buffer.from(await data.file.arrayBuffer()))
  // await fs.mkdir('public/products', { recursive: true })
  // const imagePath = `/products/${crypto.randomUUID()}-${data.image.name}`
  // await fs.writeFile(
  //   `public${imagePath}`,
  //   Buffer.from(await data.image.arrayBuffer()),
  // )

  //save remotly

  const completed = await productFilesUpload(data.file, data.image)

  const { fileUrl, imgUrl, error } = completed

  if (fileUrl && imgUrl) {
    await db.product.create({
      data: {
        isAvailableForPurchase: false,
        name: data.name,
        description: data.description,
        priceInCents: data.priceInCents,
        filePath: fileUrl,
        imagePath: imgUrl,
      },
    })

    revalidatePath('/')
    revalidatePath('/products')

    redirect('/admin/products')
  } else {
    console.log(error?.message)
  }
}

const editSchema = addSchema.extend({
  file: fileSchema.optional(),
  image: imageSchema.optional(),
})

export async function updateProduct(
  id: string,
  prevState: unknown,
  formData: FormData,
) {
  const result = editSchema.safeParse(Object.fromEntries(formData.entries()))
  if (result.success === false) {
    return result.error.formErrors.fieldErrors
  }

  const data = result.data
  const product = await db.product.findUnique({ where: { id } })

  if (product == null) return notFound()

  const completed = await updateProductFiles(
    product,
    data.file != null && data.file.size > 0 ? data.file : undefined,
    data.image != null && data.image.size > 0 ? data.image : undefined,
  )
  const { fileUrl, imgUrl } = completed

  if (fileUrl && imgUrl) {
    await db.product.update({
      where: { id },
      data: {
        isAvailableForPurchase: false,
        name: data.name,
        description: data.description,
        priceInCents: data.priceInCents,
        filePath: fileUrl,
        imagePath: imgUrl,
      },
    })
    revalidatePath('/')
    revalidatePath('/products')

    redirect('/admin/products')
  } else if (fileUrl) {
    await db.product.update({
      where: { id },
      data: {
        isAvailableForPurchase: false,
        name: data.name,
        description: data.description,
        priceInCents: data.priceInCents,
        filePath: fileUrl,
        imagePath: product.imagePath,
      },
    })
    revalidatePath('/')
    revalidatePath('/products')

    redirect('/admin/products')
  } else if (imgUrl) {
    await db.product.update({
      where: { id },
      data: {
        isAvailableForPurchase: false,
        name: data.name,
        description: data.description,
        priceInCents: data.priceInCents,
        filePath: product.filePath,
        imagePath: imgUrl,
      },
    })
    revalidatePath('/')
    revalidatePath('/products')

    redirect('/admin/products')
  }

  // let filePath = product.filePath
  // if (data.file != null && data.file.size > 0) {
  //   await fs.unlink(product.filePath)
  //   filePath = `products/${crypto.randomUUID()}-${data.file.name}`
  //   await fs.writeFile(filePath, Buffer.from(await data.file.arrayBuffer()))
  // }

  // let imagePath = product.imagePath
  // if (data.image != null && data.image.size > 0) {
  //   await fs.unlink(`public${product.imagePath}`)
  //   imagePath = `/products/${crypto.randomUUID()}-${data.image.name}`
  //   await fs.writeFile(
  //     `public${imagePath}`,
  //     Buffer.from(await data.image.arrayBuffer()),
  //   )
  // }

  // await db.product.update({
  //   where: { id },
  //   data: {
  //     name: data.name,
  //     description: data.description,
  //     priceInCents: data.priceInCents,
  //     filePath,
  //     imagePath,
  //   },
  // })

  // revalidatePath('/')
  // revalidatePath('/products')

  // redirect('/admin/products')
}

export async function toggleProductAvailability(
  id: string,
  isAvailableForPurchase: boolean,
) {
  await db.product.update({ where: { id }, data: { isAvailableForPurchase } })

  revalidatePath('/')
  revalidatePath('/products')
}

export async function deleteProduct(id: string) {
  const product = await db.product.delete({ where: { id } })

  if (product == null) return notFound()

  const [filename, extension]: [string, string] = extractFilenameFromURL(
    product.filePath,
  )
  const filePublicId = `${filename}.${extension}`
  await deleteFile(FOLDER, filePublicId)

  const [imageFileName, imageExtension]: [string, string] =
    extractFilenameFromURL(product.imagePath)
  const imageFilePublicId = `${imageFileName}.${imageExtension}`
  await deleteFile(IMAGES_FOLDER, imageFilePublicId)

  // await fs.unlink(product.filePath)
  // await fs.unlink(`public${product.imagePath}`)

  revalidatePath('/')
  revalidatePath('/products')
}
