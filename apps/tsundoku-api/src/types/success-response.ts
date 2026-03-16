export type SuccessResponse<T> = {
  status: number;
  message: string;
  data?: T;
  timestamp: string;
};

export const successResponse = <T>(status: number, message: string, data?: T): SuccessResponse<T> => ({
  status,
  message,
  data,
  timestamp: new Date().toISOString(),
});
