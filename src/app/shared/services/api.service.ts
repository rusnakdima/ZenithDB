import { Injectable } from "@angular/core";
import { HttpClient, HttpErrorResponse } from "@angular/common/http";
import { Observable, throwError } from "rxjs";
import { catchError, retry } from "rxjs/operators";

@Injectable({ providedIn: "root" })
export class ApiService {
  constructor(private http: HttpClient) {}

  get<T>(url: string, options?: Record<string, unknown>): Observable<T> {
    return this.http.get<T>(url, options).pipe(catchError(this.handleError));
  }

  post<T>(url: string, body: unknown, options?: Record<string, unknown>): Observable<T> {
    return this.http.post<T>(url, body, options).pipe(catchError(this.handleError));
  }

  put<T>(url: string, body: unknown, options?: Record<string, unknown>): Observable<T> {
    return this.http.put<T>(url, body, options).pipe(catchError(this.handleError));
  }

  delete<T>(url: string, options?: Record<string, unknown>): Observable<T> {
    return this.http.delete<T>(url, options).pipe(catchError(this.handleError));
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    let message = "An error occurred";
    if (error.error instanceof ErrorEvent) {
      message = error.error.message;
    } else {
      message = `Error: ${error.status} - ${error.statusText}`;
    }
    return throwError(() => new Error(message));
  }
}
