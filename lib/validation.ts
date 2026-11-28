import { z } from 'zod';
import { isWeekdayKey } from './dates';
import { validateGoogleMapsUrl } from './maps';
import { currentHourVN, isPastDateVN, todayVN } from './timezone';

export const registerSchema = z
  .object({
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email('Email không đúng định dạng')
      .refine((val) => val.endsWith('@gmail.com'), {
        message: 'Vui lòng sử dụng địa chỉ @gmail.com',
      }),
    password: z
      .string()
      .min(8, 'Mật khẩu phải có ít nhất 8 ký tự')
      .max(72, 'Mật khẩu tối đa 72 ký tự'),
    confirmPassword: z.string(),
    captchaToken: z.string().min(1, 'Vui lòng xác nhận bạn không phải robot'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Mật khẩu nhập lại không khớp',
    path: ['confirmPassword'],
  });

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Email không đúng định dạng'),
  password: z.string().min(1, 'Vui lòng nhập mật khẩu'),
  captchaToken: z.string().min(1, 'Vui lòng xác nhận Captcha'),
});

const dateStringSchema = z
  .string()
  .regex(/^(\d{4}-\d{2}-\d{2}|W[1-7])$/, 'Ngày không đúng định dạng');

export const createEventSchema = z
  .object({
    title: z.string().trim().min(1, 'Nhập tên sự kiện').max(80, 'Tối đa 80 ký tự'),
    note: z.string().trim().max(300, 'Ghi chú tối đa 300 ký tự').default(''),
    dates: z
      .array(dateStringSchema)
      .min(1, 'Chọn ít nhất 1 ngày')
      .max(14, 'Tối đa 14 ngày')
      .refine(
        (dates) => dates.every((d) => isWeekdayKey(d) || !isPastDateVN(d)),
        'Không thể chọn ngày ở quá khứ'
      ),
    from: z.number().int().min(0).max(23),
    to: z.number().int().min(1).max(24),
    visibility: z.enum(['link', 'private']).default('link'),
    finalizePolicy: z.enum(['owner_only', 'any_member']).default('any_member'),
  })
  .refine((d) => d.from < d.to, {
    message: 'Giờ kết thúc phải lớn hơn giờ bắt đầu',
    path: ['to'],
  })
  .refine(
    (d) => !d.dates.includes(todayVN()) || d.from > currentHourVN(),
    {
      message: 'Không thể chọn giờ ở quá khứ cho ngày hôm nay',
      path: ['from'],
    }
  );

export const updateRoomSchema = z.object({
  title: z.string().trim().min(1).max(80).optional(),
  note: z.string().trim().max(300).optional(),
  visibility: z.enum(['link', 'private']).optional(),
  finalizePolicy: z.enum(['owner_only', 'any_member']).optional(),
});

export const joinRoomSchema = z.object({
  name: z.string().trim().min(1, 'Vui lòng nhập tên của bạn').max(40, 'Tên tối đa 40 ký tự'),
  inviteToken: z.string().optional(),
});

export const saveResponseSchema = z.object({
  slots: z
    .array(z.string().regex(/^(\d{4}-\d{2}-\d{2}|W[1-7])T\d{2}$/))
    .max(400),
});

const imageUrlSchema = z
  .string()
  .trim()
  .max(500, 'Link ảnh tối đa 500 ký tự')
  .default('')
  .refine(
    (val) =>
      val === '' ||
      val.startsWith('/uploads/') ||
      val.startsWith('https://'),
    { message: 'Link ảnh phải bắt đầu bằng https:// hoặc tải lên từ thiết bị' }
  );

const itineraryStopSchema = z.object({
  id: z.string().min(1).max(64),
  category: z.enum(['checkin', 'food', 'cafe', 'play']),
  time: z.string().trim().max(10).optional().default(''),
  name: z.string().trim().min(1, 'Nhập tên chặng').max(80, 'Tối đa 80 ký tự'),
  addr: z.string().trim().max(160, 'Tối đa 160 ký tự').default(''),
  link: z
    .string()
    .trim()
    .max(300, 'Link tối đa 300 ký tự')
    .default('')
    .refine((val) => validateGoogleMapsUrl(val) !== null, {
      message: 'Link Google Maps không hợp lệ',
    }),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  imageUrl: imageUrlSchema.optional().default(''),
});

export const createPlaceSchema = z
  .object({
    type: z.enum(['single', 'itinerary']).default('single'),
    name: z.string().trim().max(80, 'Tối đa 80 ký tự').default(''),
    addr: z.string().trim().max(160, 'Tối đa 160 ký tự').default(''),
    link: z
      .string()
      .trim()
      .max(300, 'Link tối đa 300 ký tự')
      .default('')
      .refine((val) => validateGoogleMapsUrl(val) !== null, {
        message: 'Chỉ chấp nhận link Google Maps (https://maps.app.goo.gl/... hoặc google.com/maps/...)',
      }),
    imageUrl: imageUrlSchema,
    note: z.string().trim().max(200, 'Ghi chú tối đa 200 ký tự').default(''),
    stops: z.array(itineraryStopSchema).max(8, 'Tối đa 8 chặng').default([]),
  })
  .superRefine((data, ctx) => {
    if (data.type === 'single' && data.name.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Nhập tên địa điểm',
        path: ['name'],
      });
    }
    if (data.type === 'itinerary' && data.stops.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Thêm ít nhất 1 chặng vào lộ trình',
        path: ['stops'],
      });
    }
  });

export const votePlaceSchema = z.object({
  placeId: z.string().min(1),
  on: z.boolean(),
});

export const finalizeRoomSchema = z
  .object({
    date: dateStringSchema,
    from: z.number().int().min(0).max(23),
    to: z.number().int().min(1).max(24),
    placeId: z.string().nullable().optional(),
  })
  .refine((d) => d.from < d.to, {
    message: 'Khoảng giờ chốt không hợp lệ',
  });

export const updateMemberSchema = z.object({
  status: z.enum(['approved', 'removed']),
});

export const checkinSchema = z.object({
  note: z.string().trim().max(200, 'Ghi chú tối đa 200 ký tự').optional().default(''),
  photoUrl: imageUrlSchema.optional().default(''),
});

export const createMomentSchema = z.object({
  photoUrl: imageUrlSchema.refine((v) => v.length > 0, {
    message: 'Vui lòng chọn hoặc chụp ảnh khoảnh khắc',
  }),
  caption: z.string().trim().max(200, 'Ghi chú tối đa 200 ký tự').optional().default(''),
  sticker: z.enum(['', '🍻', '☕', '🎂', '🎤', '✨', '🍜']).optional().default(''),
});

export const reactMomentSchema = z.object({
  momentId: z.string().min(1),
  emoji: z.enum(['❤️', '😂', '🔥', '😮', '👏', '🎉']),
  mode: z.enum(['toggle', 'set']).optional().default('toggle'),
});

export const pinMomentSchema = z.object({
  momentId: z.string().min(1),
  pinned: z.boolean(),
});
