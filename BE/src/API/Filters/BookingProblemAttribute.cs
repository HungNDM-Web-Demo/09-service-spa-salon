using API.Middlewares;
using Application.Common.Exceptions;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace API.Filters;

/// <summary>
/// Đưa <c>code</c> (07 §2.2) vào ProblemDetails của lỗi 404 (<see cref="CodedNotFoundException"/>) và trả 429 cho
/// <see cref="TooManyRequestsException"/> kèm <c>retryAfterSeconds</c> (NFR-05). Lỗi 400, 409 có <c>code</c> đã đi qua
/// ExceptionMiddleware của nền.
/// </summary>
[AttributeUsage(AttributeTargets.Class)]
public sealed class BookingProblemAttribute : ExceptionFilterAttribute
{
    public override void OnException(ExceptionContext context)
    {
        switch (context.Exception)
        {
            case TooManyRequestsException tooMany:
            {
                var problem = ApiProblemDetails.Create(context.HttpContext, StatusCodes.Status429TooManyRequests, tooMany.Message);
                problem.Extensions["code"] = tooMany.Code;
                problem.Extensions["retryAfterSeconds"] = tooMany.RetryAfterSeconds;
                context.HttpContext.Response.Headers.RetryAfter = tooMany.RetryAfterSeconds.ToString();
                context.Result = new ObjectResult(problem) { StatusCode = StatusCodes.Status429TooManyRequests, ContentTypes = { ApiProblemDetails.ContentType } };
                context.ExceptionHandled = true;
                break;
            }
            case CodedNotFoundException notFound:
            {
                var problem = ApiProblemDetails.Create(context.HttpContext, StatusCodes.Status404NotFound, notFound.Message);
                problem.Extensions["code"] = notFound.Code;
                context.Result = new ObjectResult(problem) { StatusCode = StatusCodes.Status404NotFound, ContentTypes = { ApiProblemDetails.ContentType } };
                context.ExceptionHandled = true;
                break;
            }
        }
    }
}
