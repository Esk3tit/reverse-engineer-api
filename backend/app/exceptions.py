"""
Custom exceptions for the application
"""


class HARReverseEngineeringException(Exception):
    """Base exception for the application"""
    pass


class HARParsingError(HARReverseEngineeringException):
    """Raised when HAR file parsing fails"""
    pass


class LLMServiceError(HARReverseEngineeringException):
    """Raised when LLM service encounters an error"""
    pass


class CurlGenerationError(HARReverseEngineeringException):
    """Raised when curl command generation fails"""
    pass


class InvalidFileError(HARReverseEngineeringException):
    """Raised when uploaded file is invalid"""
    pass


class NoMatchingRequestError(HARReverseEngineeringException):
    """Raised when no matching request is found"""
    pass