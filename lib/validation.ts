import { z } from 'zod';
import { validateGoogleMapsUrl } from './maps';
import { isPastDateVN } from './timezone';

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
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày không đúng định dạng YYYY-MM-DD');

export const createEventSchema = z
  .object({
    title: z.string().trim().min(1, 'Nhập tên sự kiện').max(80, 'Tối đa 80 ký tự'),
    note: z.string().trim().max(300, 'Ghi chú tối đa 300 ký tự').default(''),
    dates: z
      .array(dateStringSchema)
      .min(1, 'Chọn ít nhất 1 ngày')
      .max(14, 'Tối đa 14 ngày')
      .refine(
        (dates) => dates.every((d) => !isPastDateVN(d)),
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
  });

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
    .array(z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}$/))
    .max(400),
});

export const createPlaceSchema = z.object({
  name: z.string().trim().min(1, 'Nhập tên địa điểm').max(80, 'Tối đa 80 ký tự'),
  addr: z.string().trim().max(160, 'Tối đa 160 ký tự').default(''),
  link: z
    .string()
    .trim()
    .max(300, 'Link tối đa 300 ký tự')
    .default('')
    .refine((val) => validateGoogleMapsUrl(val) !== null, {
      message: 'Chỉ chấp nhận link Google Maps (https://maps.app.goo.gl/... hoặc google.com/maps/...)',
    }),
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
